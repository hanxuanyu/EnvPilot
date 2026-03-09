package configapi

import configSvc "EnvPilot/internal/config/service"

type ConfigAPI struct {
	svc *configSvc.ConfigService
}

func NewConfigAPI(svc *configSvc.ConfigService) *ConfigAPI {
	return &ConfigAPI{svc: svc}
}

func (a *ConfigAPI) GetCurrent() Result[*configSvc.CurrentConfigResult] {
	result, err := a.svc.GetCurrent()
	if err != nil {
		return Fail[*configSvc.CurrentConfigResult](err.Error())
	}
	return OK(result)
}

type UpdateConfigReq struct {
	Config   map[string]any `json:"config"`
	Comment  string         `json:"comment"`
	Operator string         `json:"operator"`
}

func (a *ConfigAPI) Update(req UpdateConfigReq) Result[*configSvc.CurrentConfigResult] {
	result, err := a.svc.UpdateRaw(configSvc.UpdateRawConfigRequest(req))
	if err != nil {
		return Fail[*configSvc.CurrentConfigResult](err.Error())
	}
	return OK(result)
}

type ListSnapshotsReq struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

func (a *ConfigAPI) ListSnapshots(req ListSnapshotsReq) Result[*configSvc.ListSnapshotsResult] {
	result, err := a.svc.ListSnapshots(configSvc.ListSnapshotsRequest(req))
	if err != nil {
		return Fail[*configSvc.ListSnapshotsResult](err.Error())
	}
	return OK(result)
}

func (a *ConfigAPI) GetSnapshot(id uint) Result[*configSvc.SnapshotDetailResult] {
	result, err := a.svc.GetSnapshot(id)
	if err != nil {
		return Fail[*configSvc.SnapshotDetailResult](err.Error())
	}
	return OK(result)
}

type RollbackConfigReq struct {
	SnapshotID uint   `json:"snapshot_id"`
	Comment    string `json:"comment"`
	Operator   string `json:"operator"`
}

func (a *ConfigAPI) Rollback(req RollbackConfigReq) Result[*configSvc.CurrentConfigResult] {
	result, err := a.svc.Rollback(configSvc.RollbackConfigRequest(req))
	if err != nil {
		return Fail[*configSvc.CurrentConfigResult](err.Error())
	}
	return OK(result)
}
