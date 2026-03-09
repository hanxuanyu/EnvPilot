package connectorapi

import (
	"context"

	"EnvPilot/internal/connector"
	connectorSvc "EnvPilot/internal/connector/service"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type ConnectorAPI struct {
	ctx context.Context
	svc *connectorSvc.ConnectorService
	log *zap.Logger
}

func NewConnectorAPI(svc *connectorSvc.ConnectorService) *ConnectorAPI {
	return &ConnectorAPI{
		svc: svc,
		log: logger.Named("connector_api"),
	}
}

func (a *ConnectorAPI) SetContext(ctx context.Context) {
	a.ctx = ctx
}

func (a *ConnectorAPI) TestConnection(assetID uint) Result[bool] {
	if err := a.svc.TestConnection(a.ctx, assetID); err != nil {
		a.log.Warn("连接测试失败", zap.Uint("asset_id", assetID), zap.Error(err))
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *ConnectorAPI) ListDatabases(assetID uint) Result[[]string] {
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
	list, err := a.svc.ListTables(a.ctx, req.AssetID, req.Database)
	if err != nil {
		return Fail[[]string](err.Error())
	}
	return OK(list)
}

func (a *ConnectorAPI) ExecuteSQL(req connectorSvc.ExecuteSQLRequest) Result[*connector.QueryResult] {
	result, err := a.svc.ExecuteSQL(a.ctx, req)
	if err != nil {
		return Fail[*connector.QueryResult](err.Error())
	}
	return OK(result)
}

func (a *ConnectorAPI) ExecuteRedisCmd(req connectorSvc.ExecuteRedisCommandRequest) Result[*connector.CommandResult] {
	result, err := a.svc.ExecuteRedisCommand(a.ctx, req)
	if err != nil {
		return Fail[*connector.CommandResult](err.Error())
	}
	return OK(result)
}
