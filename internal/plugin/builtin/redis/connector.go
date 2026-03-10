package redis

import (
	"context"
	"crypto/tls"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"EnvPilot/internal/connector"

	redisv9 "github.com/redis/go-redis/v9"
)

func init() {
	connector.RegisterFactory("redis", newConnector)
}

type redisConnector struct {
	target *connector.Target
	cfg    redisConfig
	client redisv9.UniversalClient
}

type redisConfig struct {
	Host          string
	Port          int
	DB            int
	TLS           bool
	SentinelAddrs []string
	MasterName    string
	Username      string
	Password      string
}

func newConnector(target *connector.Target) (connector.Connector, error) {
	cfg, err := parseConfig(target)
	if err != nil {
		return nil, err
	}
	return &redisConnector{target: target, cfg: cfg}, nil
}

func parseConfig(target *connector.Target) (redisConfig, error) {
	host := target.ExtConfig.GetString("host")
	port := target.ExtConfig.GetInt("port")
	if host == "" {
		return redisConfig{}, fmt.Errorf("Redis 主机地址不能为空")
	}
	if port == 0 {
		port = 6379
	}

	addrs := make([]string, 0)
	for _, item := range strings.Split(target.ExtConfig.GetString("sentinel_addrs"), ",") {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			addrs = append(addrs, trimmed)
		}
	}

	result := redisConfig{
		Host:          host,
		Port:          port,
		DB:            target.ExtConfig.GetInt("db"),
		TLS:           target.ExtConfig.GetBool("tls"),
		SentinelAddrs: addrs,
		MasterName:    target.ExtConfig.GetString("master_name"),
	}
	if target.Credential != nil {
		result.Username = target.Credential.Username
		result.Password = target.Credential.Secret
	}
	return result, nil
}

func (c *redisConnector) TypeID() string { return c.target.PluginType }

func (c *redisConnector) Connect(ctx context.Context) error {
	_, err := c.ensureClient(ctx)
	return err
}

func (c *redisConnector) Ping(ctx context.Context) error {
	client, err := c.ensureClient(ctx)
	if err != nil {
		return err
	}
	return client.Ping(ctx).Err()
}

func (c *redisConnector) Close() error {
	if c.client != nil {
		err := c.client.Close()
		c.client = nil
		return err
	}
	return nil
}

func (c *redisConnector) Command(ctx context.Context, database int, command string, args ...string) (*connector.CommandResult, error) {
	client, cleanup, err := c.clientForDB(ctx, database)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	argv := make([]any, 0, len(args)+1)
	argv = append(argv, command)
	for _, arg := range args {
		argv = append(argv, arg)
	}

	result, err := client.Do(ctx, argv...).Result()
	if err != nil {
		return nil, fmt.Errorf("执行 Redis 命令失败: %w", err)
	}
	return &connector.CommandResult{Command: strings.ToUpper(command), Result: connector.NormalizeValue(result)}, nil
}

func (c *redisConnector) GetCatalog(ctx context.Context) (*connector.CacheCatalog, error) {
	client, err := c.ensureClient(ctx)
	if err != nil {
		return nil, err
	}

	info, err := client.Info(ctx, "keyspace").Result()
	if err != nil {
		return nil, fmt.Errorf("读取 Redis 键空间失败: %w", err)
	}

	databases := make([]connector.CacheDatabase, 0)
	for _, line := range strings.Split(info, "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "db") {
			continue
		}

		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		index, parseErr := strconv.Atoi(strings.TrimPrefix(parts[0], "db"))
		if parseErr != nil {
			continue
		}

		keyCount := int64(0)
		for _, item := range strings.Split(parts[1], ",") {
			pair := strings.SplitN(strings.TrimSpace(item), "=", 2)
			if len(pair) != 2 || pair[0] != "keys" {
				continue
			}
			parsed, convErr := strconv.ParseInt(pair[1], 10, 64)
			if convErr == nil {
				keyCount = parsed
			}
		}

		databases = append(databases, connector.CacheDatabase{
			Name:     fmt.Sprintf("db%d", index),
			Index:    index,
			KeyCount: keyCount,
		})
	}

	if !containsDatabase(databases, c.cfg.DB) {
		databases = append(databases, connector.CacheDatabase{
			Name:     fmt.Sprintf("db%d", c.cfg.DB),
			Index:    c.cfg.DB,
			KeyCount: 0,
		})
	}

	sort.Slice(databases, func(left, right int) bool {
		return databases[left].Index < databases[right].Index
	})

	return &connector.CacheCatalog{DefaultDatabase: c.cfg.DB, Databases: databases}, nil
}

func (c *redisConnector) ListKeys(ctx context.Context, database int, pattern string, cursor uint64, limit int) (*connector.CacheKeyPage, error) {
	client, cleanup, err := c.clientForDB(ctx, database)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	if strings.TrimSpace(pattern) == "" {
		pattern = "*"
	}

	keys, nextCursor, err := client.Scan(ctx, cursor, pattern, int64(limit)).Result()
	if err != nil {
		return nil, fmt.Errorf("扫描 Redis 键失败: %w", err)
	}
	sort.Strings(keys)

	items := make([]connector.CacheKeySummary, 0, len(keys))
	for _, key := range keys {
		keyType, typeErr := client.Type(ctx, key).Result()
		if typeErr != nil || keyType == "none" {
			continue
		}

		ttl, _ := client.TTL(ctx, key).Result()
		size, preview := c.inspectKey(ctx, client, key, keyType)
		items = append(items, connector.CacheKeySummary{
			Key:        key,
			Type:       keyType,
			TTLSeconds: normalizeTTL(ttl),
			Size:       size,
			Preview:    preview,
		})
	}

	return &connector.CacheKeyPage{Database: database, Cursor: nextCursor, Items: items}, nil
}

func (c *redisConnector) GetKeyDetail(ctx context.Context, database int, key string) (*connector.CacheKeyDetail, error) {
	client, cleanup, err := c.clientForDB(ctx, database)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	key = strings.TrimSpace(key)
	if key == "" {
		return nil, fmt.Errorf("Redis 键名不能为空")
	}

	keyType, err := client.Type(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("读取 Redis 键类型失败: %w", err)
	}
	if keyType == "none" {
		return nil, fmt.Errorf("Redis 键不存在: %s", key)
	}

	ttl, _ := client.TTL(ctx, key).Result()
	detail := &connector.CacheKeyDetail{
		Database:   database,
		Key:        key,
		Type:       keyType,
		TTLSeconds: normalizeTTL(ttl),
	}

	switch keyType {
	case "string":
		value, valueErr := client.Get(ctx, key).Result()
		if valueErr != nil && valueErr != redisv9.Nil {
			return nil, fmt.Errorf("读取 Redis 字符串失败: %w", valueErr)
		}
		detail.StringValue = value
		length, _ := client.StrLen(ctx, key).Result()
		detail.Size = length
	case "hash":
		values, valueErr := client.HGetAll(ctx, key).Result()
		if valueErr != nil {
			return nil, fmt.Errorf("读取 Redis Hash 失败: %w", valueErr)
		}
		fields := make([]string, 0, len(values))
		for field := range values {
			fields = append(fields, field)
		}
		sort.Strings(fields)
		detail.Entries = make([]connector.CacheEntry, 0, len(fields))
		for _, field := range fields {
			detail.Entries = append(detail.Entries, connector.CacheEntry{Field: field, Value: values[field]})
		}
		length, _ := client.HLen(ctx, key).Result()
		detail.Size = length
	case "list":
		values, valueErr := client.LRange(ctx, key, 0, -1).Result()
		if valueErr != nil {
			return nil, fmt.Errorf("读取 Redis List 失败: %w", valueErr)
		}
		detail.Entries = make([]connector.CacheEntry, 0, len(values))
		for _, value := range values {
			detail.Entries = append(detail.Entries, connector.CacheEntry{Value: value})
		}
		length, _ := client.LLen(ctx, key).Result()
		detail.Size = length
	case "set":
		values, valueErr := client.SMembers(ctx, key).Result()
		if valueErr != nil {
			return nil, fmt.Errorf("读取 Redis Set 失败: %w", valueErr)
		}
		sort.Strings(values)
		detail.Entries = make([]connector.CacheEntry, 0, len(values))
		for _, value := range values {
			detail.Entries = append(detail.Entries, connector.CacheEntry{Value: value})
		}
		length, _ := client.SCard(ctx, key).Result()
		detail.Size = length
	case "zset":
		values, valueErr := client.ZRangeWithScores(ctx, key, 0, -1).Result()
		if valueErr != nil {
			return nil, fmt.Errorf("读取 Redis ZSet 失败: %w", valueErr)
		}
		detail.Entries = make([]connector.CacheEntry, 0, len(values))
		for _, value := range values {
			detail.Entries = append(detail.Entries, connector.CacheEntry{Value: fmt.Sprint(value.Member), Score: value.Score})
		}
		length, _ := client.ZCard(ctx, key).Result()
		detail.Size = length
	default:
		return nil, fmt.Errorf("暂不支持查看该 Redis 类型详情: %s", keyType)
	}

	return detail, nil
}

func (c *redisConnector) SetKey(ctx context.Context, input connector.CacheKeyInput) (*connector.CacheMutationResult, error) {
	client, cleanup, err := c.clientForDB(ctx, input.Database)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	key := strings.TrimSpace(input.Key)
	keyType := strings.ToLower(strings.TrimSpace(input.Type))
	if key == "" {
		return nil, fmt.Errorf("Redis 键名不能为空")
	}
	if keyType == "" {
		return nil, fmt.Errorf("Redis 键类型不能为空")
	}

	existingType, err := client.Type(ctx, key).Result()
	if err != nil {
		return nil, fmt.Errorf("读取 Redis 键类型失败: %w", err)
	}
	if existingType != "none" && existingType != keyType {
		if err := client.Del(ctx, key).Err(); err != nil {
			return nil, fmt.Errorf("重置 Redis 键失败: %w", err)
		}
	}

	switch keyType {
	case "string":
		if err := client.Set(ctx, key, input.StringValue, 0).Err(); err != nil {
			return nil, fmt.Errorf("写入 Redis String 失败: %w", err)
		}
	case "hash":
		payload := make(map[string]string)
		for _, entry := range input.Entries {
			field := strings.TrimSpace(entry.Field)
			if field == "" {
				continue
			}
			payload[field] = entry.Value
		}
		if len(payload) == 0 {
			return nil, fmt.Errorf("Hash 类型至少需要一个字段")
		}
		if err := client.Del(ctx, key).Err(); err != nil {
			return nil, fmt.Errorf("重置 Redis Hash 失败: %w", err)
		}
		if err := client.HSet(ctx, key, payload).Err(); err != nil {
			return nil, fmt.Errorf("写入 Redis Hash 失败: %w", err)
		}
	case "list":
		values := make([]any, 0, len(input.Entries))
		for _, entry := range input.Entries {
			values = append(values, entry.Value)
		}
		if len(values) == 0 {
			return nil, fmt.Errorf("List 类型至少需要一个元素")
		}
		if err := client.Del(ctx, key).Err(); err != nil {
			return nil, fmt.Errorf("重置 Redis List 失败: %w", err)
		}
		if err := client.RPush(ctx, key, values...).Err(); err != nil {
			return nil, fmt.Errorf("写入 Redis List 失败: %w", err)
		}
	case "set":
		values := make([]any, 0, len(input.Entries))
		for _, entry := range input.Entries {
			values = append(values, entry.Value)
		}
		if len(values) == 0 {
			return nil, fmt.Errorf("Set 类型至少需要一个成员")
		}
		if err := client.Del(ctx, key).Err(); err != nil {
			return nil, fmt.Errorf("重置 Redis Set 失败: %w", err)
		}
		if err := client.SAdd(ctx, key, values...).Err(); err != nil {
			return nil, fmt.Errorf("写入 Redis Set 失败: %w", err)
		}
	case "zset":
		values := make([]redisv9.Z, 0, len(input.Entries))
		for _, entry := range input.Entries {
			values = append(values, redisv9.Z{Score: entry.Score, Member: entry.Value})
		}
		if len(values) == 0 {
			return nil, fmt.Errorf("ZSet 类型至少需要一个成员")
		}
		if err := client.Del(ctx, key).Err(); err != nil {
			return nil, fmt.Errorf("重置 Redis ZSet 失败: %w", err)
		}
		if err := client.ZAdd(ctx, key, values...).Err(); err != nil {
			return nil, fmt.Errorf("写入 Redis ZSet 失败: %w", err)
		}
	default:
		return nil, fmt.Errorf("暂不支持写入该 Redis 类型: %s", keyType)
	}

	if input.TTLSeconds != nil {
		if *input.TTLSeconds < 0 {
			if err := client.Persist(ctx, key).Err(); err != nil {
				return nil, fmt.Errorf("更新 Redis TTL 失败: %w", err)
			}
		} else if err := client.Expire(ctx, key, time.Duration(*input.TTLSeconds)*time.Second).Err(); err != nil {
			return nil, fmt.Errorf("更新 Redis TTL 失败: %w", err)
		}
	}

	return c.buildMutationResult(ctx, client, input.Database, key, keyType, "保存缓存键成功")
}

func (c *redisConnector) DeleteKey(ctx context.Context, database int, key string) (*connector.CacheMutationResult, error) {
	client, cleanup, err := c.clientForDB(ctx, database)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	key = strings.TrimSpace(key)
	if key == "" {
		return nil, fmt.Errorf("Redis 键名不能为空")
	}

	keyType, _ := client.Type(ctx, key).Result()
	if err := client.Del(ctx, key).Err(); err != nil {
		return nil, fmt.Errorf("删除 Redis 键失败: %w", err)
	}

	return &connector.CacheMutationResult{
		Database:   database,
		Key:        key,
		Type:       keyType,
		TTLSeconds: -2,
		Summary:    "删除缓存键成功",
	}, nil
}

func (c *redisConnector) ProbeMetadata(ctx context.Context) (*connector.MetadataProbeResult, error) {
	client, err := c.ensureClient(ctx)
	if err != nil {
		return nil, err
	}

	metrics := map[string]any{
		"db":  c.cfg.DB,
		"tls": c.cfg.TLS,
	}
	details := make([]string, 0, 4)

	if info, err := client.Info(ctx, "server").Result(); err == nil {
		parsed := parseInfo(info)
		if value := parsed["redis_version"]; value != "" {
			metrics["redis_version"] = value
			details = append(details, "版本 "+value)
		}
		if value := parsed["redis_mode"]; value != "" {
			metrics["redis_mode"] = value
		}
	}

	if info, err := client.Info(ctx, "stats").Result(); err == nil {
		parsed := parseInfo(info)
		if value := parsed["connected_clients"]; value != "" {
			metrics["connected_clients"] = value
			details = append(details, "客户端 "+value)
		}
		if value := parsed["blocked_clients"]; value != "" {
			metrics["blocked_clients"] = value
		}
	}

	if size, err := client.DBSize(ctx).Result(); err == nil {
		metrics["db_size"] = size
		details = append(details, "Key "+strconv.FormatInt(size, 10)+" 个")
	}

	if role, err := client.Do(ctx, "ROLE").Result(); err == nil {
		metrics["role"] = normalizeRole(role)
	}

	detail := "Redis 只读探测完成"
	if len(details) > 0 {
		detail += "：" + strings.Join(details, "，")
	}

	return &connector.MetadataProbeResult{Detail: detail, Metrics: metrics}, nil
}

func parseInfo(raw string) map[string]string {
	result := make(map[string]string)
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		result[parts[0]] = parts[1]
	}
	return result
}

func normalizeRole(value any) string {
	switch typed := value.(type) {
	case []any:
		if len(typed) == 0 {
			return ""
		}
		return fmt.Sprint(typed[0])
	default:
		return fmt.Sprint(value)
	}
}

func containsDatabase(databases []connector.CacheDatabase, target int) bool {
	for _, item := range databases {
		if item.Index == target {
			return true
		}
	}
	return false
}

func normalizeTTL(value time.Duration) int64 {
	if value < 0 {
		return -1
	}
	return int64(value / time.Second)
}

func (c *redisConnector) inspectKey(ctx context.Context, client redisv9.UniversalClient, key, keyType string) (int64, string) {
	switch keyType {
	case "string":
		value, err := client.Get(ctx, key).Result()
		if err != nil && err != redisv9.Nil {
			return 0, ""
		}
		if len(value) > 80 {
			value = value[:80] + "..."
		}
		length, _ := client.StrLen(ctx, key).Result()
		return length, value
	case "hash":
		length, _ := client.HLen(ctx, key).Result()
		return length, fmt.Sprintf("%d fields", length)
	case "list":
		length, _ := client.LLen(ctx, key).Result()
		return length, fmt.Sprintf("%d items", length)
	case "set":
		length, _ := client.SCard(ctx, key).Result()
		return length, fmt.Sprintf("%d members", length)
	case "zset":
		length, _ := client.ZCard(ctx, key).Result()
		return length, fmt.Sprintf("%d scored members", length)
	default:
		return 0, keyType
	}
}

func (c *redisConnector) buildMutationResult(ctx context.Context, client redisv9.UniversalClient, database int, key, keyType, summary string) (*connector.CacheMutationResult, error) {
	ttl, _ := client.TTL(ctx, key).Result()
	size, _ := c.inspectKey(ctx, client, key, keyType)
	return &connector.CacheMutationResult{
		Database:   database,
		Key:        key,
		Type:       keyType,
		TTLSeconds: normalizeTTL(ttl),
		Size:       size,
		Summary:    summary,
	}, nil
}

func (c *redisConnector) clientForDB(ctx context.Context, database int) (redisv9.UniversalClient, func(), error) {
	if database < 0 {
		database = c.cfg.DB
	}
	if database == c.cfg.DB {
		client, err := c.ensureClient(ctx)
		return client, func() {}, err
	}

	var tlsConfig *tls.Config
	if c.cfg.TLS {
		tlsConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	var client redisv9.UniversalClient
	if len(c.cfg.SentinelAddrs) > 0 && c.cfg.MasterName != "" {
		client = redisv9.NewFailoverClient(&redisv9.FailoverOptions{
			MasterName:    c.cfg.MasterName,
			SentinelAddrs: c.cfg.SentinelAddrs,
			DB:            database,
			Username:      c.cfg.Username,
			Password:      c.cfg.Password,
			TLSConfig:     tlsConfig,
		})
	} else {
		client = redisv9.NewClient(&redisv9.Options{
			Addr:      fmt.Sprintf("%s:%d", c.cfg.Host, c.cfg.Port),
			DB:        database,
			Username:  c.cfg.Username,
			Password:  c.cfg.Password,
			TLSConfig: tlsConfig,
		})
	}

	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, nil, fmt.Errorf("连接 Redis 失败: %w", err)
	}
	return client, func() { _ = client.Close() }, nil
}

func (c *redisConnector) ensureClient(ctx context.Context) (redisv9.UniversalClient, error) {
	if c.client != nil {
		return c.client, nil
	}

	var tlsConfig *tls.Config
	if c.cfg.TLS {
		tlsConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}

	if len(c.cfg.SentinelAddrs) > 0 && c.cfg.MasterName != "" {
		c.client = redisv9.NewFailoverClient(&redisv9.FailoverOptions{
			MasterName:    c.cfg.MasterName,
			SentinelAddrs: c.cfg.SentinelAddrs,
			DB:            c.cfg.DB,
			Username:      c.cfg.Username,
			Password:      c.cfg.Password,
			TLSConfig:     tlsConfig,
		})
	} else {
		c.client = redisv9.NewClient(&redisv9.Options{
			Addr:      fmt.Sprintf("%s:%d", c.cfg.Host, c.cfg.Port),
			DB:        c.cfg.DB,
			Username:  c.cfg.Username,
			Password:  c.cfg.Password,
			TLSConfig: tlsConfig,
		})
	}

	if err := c.client.Ping(ctx).Err(); err != nil {
		_ = c.client.Close()
		c.client = nil
		return nil, fmt.Errorf("连接 Redis 失败: %w", err)
	}
	return c.client, nil
}
