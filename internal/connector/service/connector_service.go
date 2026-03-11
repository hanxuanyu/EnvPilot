package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	assetSvc "EnvPilot/internal/asset/service"
	auditSvc "EnvPilot/internal/audit/service"
	"EnvPilot/internal/connector"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type ConnectorService struct {
	assetSvc *assetSvc.AssetService
	credSvc  *assetSvc.CredentialService
	auditSvc *auditSvc.AuditService
	log      *zap.Logger
}

const (
	defaultConnectorOpTimeout = 15 * time.Second
	catalogConnectorOpTimeout = 30 * time.Second
	sqlConnectorOpTimeout     = 60 * time.Second
)

type ExecuteSQLRequest struct {
	AssetID  uint   `json:"asset_id"`
	Database string `json:"database"`
	Query    string `json:"query"`
	Limit    int    `json:"limit"`
}

type TableDetailRequest struct {
	AssetID  uint   `json:"asset_id"`
	Database string `json:"database"`
	Table    string `json:"table"`
}

type ExecuteRedisCommandRequest struct {
	AssetID  uint     `json:"asset_id"`
	Database int      `json:"database"`
	Command  string   `json:"command"`
	Args     []string `json:"args"`
}

type CacheKeyListRequest struct {
	AssetID  uint   `json:"asset_id"`
	Database int    `json:"database"`
	Pattern  string `json:"pattern"`
	Cursor   uint64 `json:"cursor"`
	Limit    int    `json:"limit"`
}

type CacheKeyDetailRequest struct {
	AssetID  uint   `json:"asset_id"`
	Database int    `json:"database"`
	Key      string `json:"key"`
}

type CacheKeySaveRequest struct {
	AssetID uint                    `json:"asset_id"`
	Input   connector.CacheKeyInput `json:"input"`
}

type CacheKeyDeleteRequest struct {
	AssetID  uint   `json:"asset_id"`
	Database int    `json:"database"`
	Key      string `json:"key"`
}

type SendMQMessageRequest struct {
	AssetID uint              `json:"asset_id"`
	Message connector.Message `json:"message"`
}

func NewConnectorService(assetSvc *assetSvc.AssetService, credSvc *assetSvc.CredentialService, auditSvc *auditSvc.AuditService) *ConnectorService {
	return &ConnectorService{
		assetSvc: assetSvc,
		credSvc:  credSvc,
		auditSvc: auditSvc,
		log:      logger.Named("connector_service"),
	}
}

func (s *ConnectorService) TestConnection(ctx context.Context, assetID uint) error {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	target, targetErr := s.resolveTarget(assetID)
	conn, err := s.newConnector(assetID)
	if err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "connector",
			Action:       "test_connection",
			ResourceType: "asset",
			ResourceID:   uintPtr(assetID),
			ResourceName: targetName(target, targetErr),
			PluginType:   targetPlugin(target),
			Success:      false,
			Detail:       err.Error(),
		})
		return err
	}
	defer conn.Close()

	if err := conn.Ping(ctx); err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "connector",
			Action:       "test_connection",
			ResourceType: "asset",
			ResourceID:   uintPtr(assetID),
			ResourceName: targetName(target, targetErr),
			PluginType:   conn.TypeID(),
			Success:      false,
			Detail:       err.Error(),
		})
		return err
	}

	s.log.Info("连接测试成功", zap.Uint("asset_id", assetID), zap.String("type", conn.TypeID()))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "connector",
		Action:       "test_connection",
		ResourceType: "asset",
		ResourceID:   uintPtr(assetID),
		ResourceName: targetName(target, targetErr),
		PluginType:   conn.TypeID(),
		Success:      true,
		Detail:       "连接测试成功",
	})
	return nil
}

func (s *ConnectorService) ListDatabases(ctx context.Context, assetID uint) ([]string, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	dbConn, cleanup, err := s.newDatabaseConnector(assetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	return dbConn.ListDatabases(ctx)
}

func (s *ConnectorService) ListTables(ctx context.Context, assetID uint, database string) ([]string, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	dbConn, cleanup, err := s.newDatabaseConnector(assetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	return dbConn.ListTables(ctx, database)
}

func (s *ConnectorService) GetDatabaseCatalog(ctx context.Context, assetID uint) (*connector.DatabaseCatalog, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, catalogConnectorOpTimeout)
	defer cancel()

	target, err := s.resolveTarget(assetID)
	if err != nil {
		return nil, err
	}

	dbConn, cleanup, err := s.newDatabaseConnector(assetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	databases, err := dbConn.ListDatabases(ctx)
	if err != nil {
		return nil, err
	}

	catalog := &connector.DatabaseCatalog{
		DefaultDatabase: strings.TrimSpace(target.ExtConfig.GetString("database")),
		Schema:          strings.TrimSpace(target.ExtConfig.GetString("schema")),
		Databases:       make([]connector.DatabaseCatalogItem, 0, len(databases)),
	}

	for _, databaseName := range databases {
		item := connector.DatabaseCatalogItem{Name: databaseName}
		tables, tableErr := dbConn.ListTables(ctx, databaseName)
		if tableErr != nil {
			item.Error = tableErr.Error()
		} else {
			item.Tables = tables
		}
		catalog.Databases = append(catalog.Databases, item)
	}

	if len(catalog.Databases) == 0 && catalog.DefaultDatabase != "" {
		item := connector.DatabaseCatalogItem{Name: catalog.DefaultDatabase}
		tables, tableErr := dbConn.ListTables(ctx, catalog.DefaultDatabase)
		if tableErr != nil {
			item.Error = tableErr.Error()
		} else {
			item.Tables = tables
		}
		catalog.Databases = append(catalog.Databases, item)
	}

	return catalog, nil
}

func (s *ConnectorService) GetTableDetail(ctx context.Context, req TableDetailRequest) (*connector.TableDetail, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	if strings.TrimSpace(req.Table) == "" {
		return nil, fmt.Errorf("数据表名不能为空")
	}

	dbConn, cleanup, err := s.newDatabaseConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	detail, err := dbConn.GetTableDetail(ctx, strings.TrimSpace(req.Database), strings.TrimSpace(req.Table))
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "describe_table",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"database": strings.TrimSpace(req.Database),
				"table":    strings.TrimSpace(req.Table),
			},
		})
		return nil, err
	}

	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "describe_table",
		ResourceType: "asset",
		Success:      true,
		Detail:       "查看数据表详情成功",
		Request: map[string]any{
			"database": strings.TrimSpace(req.Database),
			"table":    strings.TrimSpace(req.Table),
		},
		Result: map[string]any{
			"column_count": len(detail.Columns),
		},
	})

	return detail, nil
}

func (s *ConnectorService) ExecuteSQL(ctx context.Context, req ExecuteSQLRequest) (*connector.QueryResult, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, sqlConnectorOpTimeout)
	defer cancel()

	query, err := normalizeSQL(req.Query)
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
		limit = 500
	}
	if limit > 5000 {
		limit = 5000
	}

	result, err := dbConn.Execute(ctx, strings.TrimSpace(req.Database), query, limit)
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "execute_sql",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"database": strings.TrimSpace(req.Database),
				"query":    query,
				"limit":    limit,
			},
		})
		return nil, err
	}

	s.log.Info("执行 SQL 成功",
		zap.Uint("asset_id", req.AssetID),
		zap.String("database", strings.TrimSpace(req.Database)),
		zap.Int("row_count", len(result.Rows)),
	)
	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "execute_sql",
		ResourceType: "asset",
		Success:      true,
		Detail:       "执行 SQL 成功",
		Request: map[string]any{
			"database": strings.TrimSpace(req.Database),
			"query":    query,
			"limit":    limit,
		},
		Result: map[string]any{
			"row_count":     len(result.Rows),
			"duration_ms":   result.DurationMS,
			"affected_rows": result.Affected,
		},
	})
	return result, nil
}

func (s *ConnectorService) ExecuteRedisCommand(ctx context.Context, req ExecuteRedisCommandRequest) (*connector.CommandResult, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	command := strings.ToUpper(strings.TrimSpace(req.Command))
	if command == "" {
		return nil, fmt.Errorf("Redis 命令不能为空")
	}

	cacheConn, cleanup, err := s.newCacheConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := cacheConn.Command(ctx, req.Database, command, req.Args...)
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "execute_redis_command",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"database": req.Database,
				"command":  command,
				"args":     req.Args,
			},
		})
		return nil, err
	}

	s.log.Info("执行 Redis 命令成功",
		zap.Uint("asset_id", req.AssetID),
		zap.String("command", command),
	)
	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "execute_redis_command",
		ResourceType: "asset",
		Success:      true,
		Detail:       "执行 Redis 命令成功",
		Request: map[string]any{
			"database": req.Database,
			"command":  command,
			"args":     req.Args,
		},
		Result: result,
	})
	return result, nil
}

func (s *ConnectorService) GetCacheCatalog(ctx context.Context, assetID uint) (*connector.CacheCatalog, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	cacheConn, cleanup, err := s.newCacheConnector(assetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	return cacheConn.GetCatalog(ctx)
}

func (s *ConnectorService) ListCacheKeys(ctx context.Context, req CacheKeyListRequest) (*connector.CacheKeyPage, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	cacheConn, cleanup, err := s.newCacheConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := cacheConn.ListKeys(ctx, req.Database, strings.TrimSpace(req.Pattern), req.Cursor, req.Limit)
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "list_cache_keys",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"database": req.Database,
				"pattern":  strings.TrimSpace(req.Pattern),
				"cursor":   req.Cursor,
				"limit":    req.Limit,
			},
		})
		return nil, err
	}

	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "list_cache_keys",
		ResourceType: "asset",
		Success:      true,
		Detail:       "查询缓存键列表成功",
		Request: map[string]any{
			"database": req.Database,
			"pattern":  strings.TrimSpace(req.Pattern),
			"cursor":   req.Cursor,
			"limit":    req.Limit,
		},
		Result: map[string]any{
			"count":  len(result.Items),
			"cursor": result.Cursor,
		},
	})
	return result, nil
}

func (s *ConnectorService) GetCacheKeyDetail(ctx context.Context, req CacheKeyDetailRequest) (*connector.CacheKeyDetail, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	if strings.TrimSpace(req.Key) == "" {
		return nil, fmt.Errorf("缓存键名不能为空")
	}

	cacheConn, cleanup, err := s.newCacheConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := cacheConn.GetKeyDetail(ctx, req.Database, strings.TrimSpace(req.Key))
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "describe_cache_key",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"database": req.Database,
				"key":      strings.TrimSpace(req.Key),
			},
		})
		return nil, err
	}

	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "describe_cache_key",
		ResourceType: "asset",
		Success:      true,
		Detail:       "查看缓存键详情成功",
		Request: map[string]any{
			"database": req.Database,
			"key":      strings.TrimSpace(req.Key),
		},
		Result: map[string]any{
			"type":  result.Type,
			"size":  result.Size,
			"count": len(result.Entries),
		},
	})
	return result, nil
}

func (s *ConnectorService) SaveCacheKey(ctx context.Context, req CacheKeySaveRequest) (*connector.CacheMutationResult, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	cacheConn, cleanup, err := s.newCacheConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := cacheConn.SetKey(ctx, req.Input)
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "save_cache_key",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request:      req.Input,
		})
		return nil, err
	}

	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "save_cache_key",
		ResourceType: "asset",
		Success:      true,
		Detail:       result.Summary,
		Request:      req.Input,
		Result:       result,
	})
	return result, nil
}

func (s *ConnectorService) DeleteCacheKey(ctx context.Context, req CacheKeyDeleteRequest) (*connector.CacheMutationResult, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	if strings.TrimSpace(req.Key) == "" {
		return nil, fmt.Errorf("缓存键名不能为空")
	}

	cacheConn, cleanup, err := s.newCacheConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := cacheConn.DeleteKey(ctx, req.Database, strings.TrimSpace(req.Key))
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "delete_cache_key",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"database": req.Database,
				"key":      strings.TrimSpace(req.Key),
			},
		})
		return nil, err
	}

	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "delete_cache_key",
		ResourceType: "asset",
		Success:      true,
		Detail:       result.Summary,
		Request: map[string]any{
			"database": req.Database,
			"key":      strings.TrimSpace(req.Key),
		},
		Result: result,
	})
	return result, nil
}

func (s *ConnectorService) SendMQMessage(ctx context.Context, req SendMQMessageRequest) (*connector.SendResult, error) {
	ctx, cancel := withTimeoutIfAbsent(ctx, defaultConnectorOpTimeout)
	defer cancel()

	mqConn, cleanup, err := s.newMQConnector(req.AssetID)
	if err != nil {
		return nil, err
	}
	defer cleanup()

	result, err := mqConn.SendMessage(ctx, req.Message)
	if err != nil {
		s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
			Module:       "connector",
			Action:       "send_mq_message",
			ResourceType: "asset",
			Success:      false,
			Detail:       err.Error(),
			Request:      summarizeMQMessage(req.Message),
		})
		return nil, err
	}

	s.log.Info("发送 MQ 消息成功",
		zap.Uint("asset_id", req.AssetID),
		zap.String("topic", req.Message.Topic),
		zap.String("exchange", req.Message.Exchange),
	)
	s.recordConnectorAudit(req.AssetID, auditSvc.RecordInput{
		Module:       "connector",
		Action:       "send_mq_message",
		ResourceType: "asset",
		Success:      true,
		Detail:       "发送 MQ 消息成功",
		Request:      summarizeMQMessage(req.Message),
		Result:       result,
	})
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

func (s *ConnectorService) newMQConnector(assetID uint) (connector.MQConnector, func(), error) {
	conn, err := s.newConnector(assetID)
	if err != nil {
		return nil, nil, err
	}

	mqConn, ok := conn.(connector.MQConnector)
	if !ok {
		_ = conn.Close()
		return nil, nil, fmt.Errorf("资产不支持消息队列操作")
	}

	return mqConn, func() { _ = mqConn.Close() }, nil
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

func withTimeoutIfAbsent(parent context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	if parent == nil {
		return context.WithTimeout(context.Background(), timeout)
	}
	if _, ok := parent.Deadline(); ok {
		return context.WithCancel(parent)
	}
	return context.WithTimeout(parent, timeout)
}

func normalizeSQL(query string) (string, error) {
	trimmed := strings.TrimSpace(query)
	if trimmed == "" {
		return "", fmt.Errorf("SQL 不能为空")
	}

	return trimmed, nil
}

func (s *ConnectorService) recordConnectorAudit(assetID uint, input auditSvc.RecordInput) {
	target, err := s.resolveTarget(assetID)
	if err == nil {
		input.ResourceID = uintPtr(assetID)
		input.ResourceName = target.AssetName
		if input.PluginType == "" {
			input.PluginType = target.PluginType
		}
	} else if input.ResourceID == nil {
		input.ResourceID = uintPtr(assetID)
	}
	s.recordAudit(input)
}

func (s *ConnectorService) recordAudit(input auditSvc.RecordInput) {
	if s.auditSvc == nil {
		return
	}
	s.auditSvc.RecordBestEffort(input)
}

func summarizeMQMessage(msg connector.Message) map[string]any {
	return map[string]any{
		"topic":        msg.Topic,
		"tag":          msg.Tag,
		"exchange":     msg.Exchange,
		"routing_key":  msg.RoutingKey,
		"key":          msg.Key,
		"header_count": len(msg.Headers),
		"body_length":  len(msg.Body),
	}
}

func uintPtr(value uint) *uint {
	return &value
}

func targetName(target *connector.Target, err error) string {
	if err != nil || target == nil {
		return ""
	}
	return target.AssetName
}

func targetPlugin(target *connector.Target) string {
	if target == nil {
		return ""
	}
	return target.PluginType
}
