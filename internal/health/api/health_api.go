package healthapi

import (
	"context"

	authSvc "EnvPilot/internal/auth/service"
	healthModel "EnvPilot/internal/health/model"
	healthSvc "EnvPilot/internal/health/service"
	"EnvPilot/internal/plugin"
)

type HealthAPI struct {
	ctx  context.Context
	svc  *healthSvc.HealthService
	auth *authSvc.Service
}

func NewHealthAPI(svc *healthSvc.HealthService, auth *authSvc.Service) *HealthAPI {
	return &HealthAPI{svc: svc, auth: auth}
}

func (a *HealthAPI) requireAdmin() error {
	if a.auth == nil {
		return nil
	}
	return a.auth.RequireAdmin("")
}

func (a *HealthAPI) SetContext(ctx context.Context) {
	a.ctx = ctx
}

type ListSnapshotsReq struct {
	EnvironmentID uint                     `json:"environment_id"`
	Category      plugin.AssetCategory     `json:"category"`
	Status        healthModel.HealthStatus `json:"status"`
	Keyword       string                   `json:"keyword"`
	Limit         int                      `json:"limit"`
	Offset        int                      `json:"offset"`
}

func (a *HealthAPI) ListSnapshots(req ListSnapshotsReq) Result[*healthSvc.ListSnapshotsResult] {
	result, err := a.svc.ListSnapshots(healthSvc.ListSnapshotsRequest(req))
	if err != nil {
		return Fail[*healthSvc.ListSnapshotsResult](err.Error())
	}
	return OK(result)
}

func (a *HealthAPI) GetSummary(req ListSnapshotsReq) Result[*healthSvc.SummaryResult] {
	result, err := a.svc.GetSummary(healthSvc.ListSnapshotsRequest(req))
	if err != nil {
		return Fail[*healthSvc.SummaryResult](err.Error())
	}
	return OK(result)
}

func (a *HealthAPI) CheckAsset(assetID uint) Result[*healthModel.HealthSnapshot] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*healthModel.HealthSnapshot](err.Error())
	}
	result, err := a.svc.CheckAsset(a.requestContext(), assetID)
	if err != nil {
		return Fail[*healthModel.HealthSnapshot](err.Error())
	}
	return OK(result)
}

type CheckAllReq struct {
	EnvironmentID uint                 `json:"environment_id"`
	Category      plugin.AssetCategory `json:"category"`
}

func (a *HealthAPI) CheckAll(req CheckAllReq) Result[*healthSvc.CheckAllResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*healthSvc.CheckAllResult](err.Error())
	}
	result, err := a.svc.CheckAll(a.requestContext(), healthSvc.CheckAllRequest{
		EnvironmentID: req.EnvironmentID,
		Category:      req.Category,
	})
	if err != nil {
		return Fail[*healthSvc.CheckAllResult](err.Error())
	}
	return OK(result)
}

func (a *HealthAPI) requestContext() context.Context {
	if a == nil || a.ctx == nil {
		return context.Background()
	}
	return a.ctx
}
