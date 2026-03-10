package connectorapi

import (
	"context"

	authSvc "EnvPilot/internal/auth/service"
	"EnvPilot/internal/connector"
	connectorSvc "EnvPilot/internal/connector/service"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type ConnectorAPI struct {
	ctx  context.Context
	svc  *connectorSvc.ConnectorService
	auth *authSvc.Service
	log  *zap.Logger
}

func NewConnectorAPI(svc *connectorSvc.ConnectorService, auth *authSvc.Service) *ConnectorAPI {
	return &ConnectorAPI{
		svc:  svc,
		auth: auth,
		log:  logger.Named("connector_api"),
	}
}

func (a *ConnectorAPI) requireAdmin() error {
	if a.auth == nil {
		return nil
	}
	return a.auth.RequireAdmin("")
}

func (a *ConnectorAPI) SetContext(ctx context.Context) {
	a.ctx = ctx
}

func (a *ConnectorAPI) TestConnection(assetID uint) Result[bool] {
	if err := a.requireAdmin(); err != nil {
		return Fail[bool](err.Error())
	}
	if err := a.svc.TestConnection(a.ctx, assetID); err != nil {
		a.log.Warn("连接测试失败", zap.Uint("asset_id", assetID), zap.Error(err))
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *ConnectorAPI) GetDatabaseCatalog(assetID uint) Result[*connector.DatabaseCatalog] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*connector.DatabaseCatalog](err.Error())
	}
	catalog, err := a.svc.GetDatabaseCatalog(a.ctx, assetID)
	if err != nil {
		return Fail[*connector.DatabaseCatalog](err.Error())
	}
	return OK(catalog)
}

func (a *ConnectorAPI) ListDatabases(assetID uint) Result[[]string] {
	if err := a.requireAdmin(); err != nil {
		return Fail[[]string](err.Error())
	}
	list, err := a.svc.ListDatabases(a.ctx, assetID)
	if err != nil {
		return Fail[[]string](err.Error())
	}
	return OK(list)
}

type ListTablesReq struct {
	AssetID  uint   `json:"asset_id"`
	Database string `json:"database"`
}

func (a *ConnectorAPI) ListTables(req ListTablesReq) Result[[]string] {
	if err := a.requireAdmin(); err != nil {
		return Fail[[]string](err.Error())
	}
	list, err := a.svc.ListTables(a.ctx, req.AssetID, req.Database)
	if err != nil {
		return Fail[[]string](err.Error())
	}
	return OK(list)
}

func (a *ConnectorAPI) GetTableDetail(req connectorSvc.TableDetailRequest) Result[*connector.TableDetail] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*connector.TableDetail](err.Error())
	}
	result, err := a.svc.GetTableDetail(a.ctx, req)
	if err != nil {
		return Fail[*connector.TableDetail](err.Error())
	}
	return OK(result)
}

func (a *ConnectorAPI) ExecuteSQL(req connectorSvc.ExecuteSQLRequest) Result[*connector.QueryResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*connector.QueryResult](err.Error())
	}
	result, err := a.svc.ExecuteSQL(a.ctx, req)
	if err != nil {
		return Fail[*connector.QueryResult](err.Error())
	}
	return OK(result)
}

func (a *ConnectorAPI) ExecuteRedisCmd(req connectorSvc.ExecuteRedisCommandRequest) Result[*connector.CommandResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*connector.CommandResult](err.Error())
	}
	result, err := a.svc.ExecuteRedisCommand(a.ctx, req)
	if err != nil {
		return Fail[*connector.CommandResult](err.Error())
	}
	return OK(result)
}

func (a *ConnectorAPI) SendMQMessage(req connectorSvc.SendMQMessageRequest) Result[*connector.SendResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*connector.SendResult](err.Error())
	}
	result, err := a.svc.SendMQMessage(a.ctx, req)
	if err != nil {
		return Fail[*connector.SendResult](err.Error())
	}
	return OK(result)
}
