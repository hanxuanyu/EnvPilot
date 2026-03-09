package redis

import (
	"context"
	"crypto/tls"
	"fmt"
	"strings"

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

func (c *redisConnector) Command(ctx context.Context, command string, args ...string) (*connector.CommandResult, error) {
	client, err := c.ensureClient(ctx)
	if err != nil {
		return nil, err
	}

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
