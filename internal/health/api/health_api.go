package healthapi

import (
	"context"

	healthModel "EnvPilot/internal/health/model"
	healthSvc "EnvPilot/internal/health/service"
	"EnvPilot/internal/plugin"
)

type HealthAPI struct {
	svc *healthSvc.HealthService
}

func NewHealthAPI(svc *healthSvc.HealthService) *HealthAPI {
	return &HealthAPI{svc: svc}
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
	result, err := a.svc.CheckAsset(context.Background(), assetID)
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
	result, err := a.svc.CheckAll(context.Background(), healthSvc.CheckAllRequest(req))
	if err != nil {
		return Fail[*healthSvc.CheckAllResult](err.Error())
	}
	return OK(result)
}
