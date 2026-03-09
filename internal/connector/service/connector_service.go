package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	assetSvc "EnvPilot/internal/asset/service"
	"EnvPilot/internal/connector"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type ConnectorService struct {
	assetSvc *assetSvc.AssetService
	credSvc  *assetSvc.CredentialService
	log      *zap.Logger
}

type ExecuteSQLRequest struct {
	AssetID  uint   `json:"asset_id"`
	Database string `json:"database"`
	Query    string `json:"query"`
	Limit    int    `json:"limit"`
}

type ExecuteRedisCommandRequest struct {
	AssetID uint     `json:"asset_id"`
	Command string   `json:"command"`
	Args    []string `json:"args"`
}

func NewConnectorService(assetSvc *assetSvc.AssetService, credSvc *assetSvc.CredentialService) *ConnectorService {
	return &ConnectorService{
		assetSvc: assetSvc,
		credSvc:  credSvc,
		log:      logger.Named("connector_service"),
	}
}

func (s *ConnectorService) TestConnection(ctx context.Context, assetID uint) error {
	conn, err := s.newConnector(assetID)
	if err != nil {
		return err
	}
	defer conn.Close()

	if err := conn.Ping(ctx); err != nil {
		return err
	}

	s.log.Info("连接测试成功", zap.Uint("asset_id", assetID), zap.String("type", conn.TypeID()))
	return nil
}

func (s *ConnectorService) ListDatabases(ctx context.Context, assetID uint) ([]string, error) {
	dbConn, cleanup, err := s.newDatabaseConnector(assetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	return dbConn.ListDatabases(ctx)
}

func (s *ConnectorService) ListTables(ctx context.Context, assetID uint, database string) ([]string, error) {
	dbConn, cleanup, err := s.newDatabaseConnector(assetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	return dbConn.ListTables(ctx, database)
}

func (s *ConnectorService) ExecuteSQL(ctx context.Context, req ExecuteSQLRequest) (*connector.QueryResult, error) {
	query, err := sanitizeReadOnlySQL(req.Query)
	if err != nil {
		return nil, err
	}

	dbConn, cleanup, err := s.newDatabaseConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	limit := req.Limit
	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	result, err := dbConn.Execute(ctx, strings.TrimSpace(req.Database), query, limit)
	if err != nil {
		return nil, err
	}

	s.log.Info("执行 SQL 成功",
		zap.Uint("asset_id", req.AssetID),
		zap.String("database", strings.TrimSpace(req.Database)),
		zap.Int("row_count", len(result.Rows)),
	)
	return result, nil
}

func (s *ConnectorService) ExecuteRedisCommand(ctx context.Context, req ExecuteRedisCommandRequest) (*connector.CommandResult, error) {
	command := strings.ToUpper(strings.TrimSpace(req.Command))
	if !isAllowedRedisCommand(command) {
		return nil, fmt.Errorf("Redis 命令不在允许列表: %s", command)
	}

	cacheConn, cleanup, err := s.newCacheConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := cacheConn.Command(ctx, command, req.Args...)
	if err != nil {
		return nil, err
	}

	s.log.Info("执行 Redis 命令成功",
		zap.Uint("asset_id", req.AssetID),
		zap.String("command", command),
	)
	return result, nil
}

func (s *ConnectorService) newConnector(assetID uint) (connector.Connector, error) {
	target, err := s.resolveTarget(assetID)
	if err != nil {
		return nil, err
	}
	return connector.NewConnector(target)
}

func (s *ConnectorService) newDatabaseConnector(assetID uint) (connector.DatabaseConnector, func(), error) {
	conn, err := s.newConnector(assetID)
	if err != nil {
		return nil, nil, err
	}

	dbConn, ok := conn.(connector.DatabaseConnector)
	if !ok {
		_ = conn.Close()
		return nil, nil, fmt.Errorf("资产不支持数据库操作")
	}

	return dbConn, func() { _ = dbConn.Close() }, nil
}

func (s *ConnectorService) newCacheConnector(assetID uint) (connector.CacheConnector, func(), error) {
	conn, err := s.newConnector(assetID)
	if err != nil {
		return nil, nil, err
	}

	cacheConn, ok := conn.(connector.CacheConnector)
	if !ok {
		_ = conn.Close()
		return nil, nil, fmt.Errorf("资产不支持缓存命令操作")
	}

	return cacheConn, func() { _ = cacheConn.Close() }, nil
}

func (s *ConnectorService) resolveTarget(assetID uint) (*connector.Target, error) {
	asset, err := s.assetSvc.GetByID(assetID)
	if err != nil {
		return nil, fmt.Errorf("查询资产失败: %w", err)
	}

	var credential *connector.Credential
	if asset.CredentialID != nil {
		secret, err := s.credSvc.RevealSecret(*asset.CredentialID)
		if err != nil {
			return nil, fmt.Errorf("解密资产凭据失败: %w", err)
		}

		if asset.Credential == nil {
			return nil, fmt.Errorf("资产凭据加载失败")
		}

		credential = &connector.Credential{
			Type:     asset.Credential.Type,
			Username: asset.Credential.Username,
			Secret:   secret,
		}
	}

	return &connector.Target{
		AssetID:    asset.ID,
		AssetName:  asset.Name,
		PluginType: asset.PluginType,
		ExtConfig:  asset.ExtConfig,
		Credential: credential,
	}, nil
}

func sanitizeReadOnlySQL(query string) (string, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return "", fmt.Errorf("SQL 不能为空")
	}

	trimmed = strings.TrimSuffix(trimmed, ";")
	if strings.Contains(trimmed, ";") {
		return "", fmt.Errorf("不允许执行多条 SQL")
	}

	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return "", fmt.Errorf("SQL 不能为空")
	}

	allowedFirstTokens := map[string]struct{}{
		"SELECT":   {},
		"SHOW":     {},
		"DESC":     {},
		"DESCRIBE": {},
		"EXPLAIN":  {},
		"WITH":     {},
	}

	firstToken := strings.ToUpper(fields[0])
	if _, ok := allowedFirstTokens[firstToken]; !ok {
		return "", fmt.Errorf("仅允许执行只读 SQL")
	}

	if firstToken == "WITH" {
		dangerous := regexp.MustCompile(`(?i)\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|replace)\b`)
		if dangerous.MatchString(trimmed) {
			return "", fmt.Errorf("WITH 语句仅允许只读查询")
		}
	}

	return trimmed, nil
}

func isAllowedRedisCommand(command string) bool {
	allowed := map[string]struct{}{
		"PING":          {},
		"GET":           {},
		"MGET":          {},
		"EXISTS":        {},
		"TYPE":          {},
		"TTL":           {},
		"PTTL":          {},
		"DBSIZE":        {},
		"INFO":          {},
		"HGET":          {},
		"HGETALL":       {},
		"HKEYS":         {},
		"HLEN":          {},
		"LRANGE":        {},
		"LINDEX":        {},
		"LLEN":          {},
		"SMEMBERS":      {},
		"SCARD":         {},
		"ZRANGE":        {},
		"ZRANGEBYSCORE": {},
		"ZSCORE":        {},
		"SCAN":          {},
		"SSCAN":         {},
		"HSCAN":         {},
		"ZSCAN":         {},
	}
	_, ok := allowed[command]
	return ok
}
