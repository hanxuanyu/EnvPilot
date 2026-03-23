package dnsapi

import (
	authSvc "EnvPilot/internal/auth/service"
	"EnvPilot/internal/dns/model"
	"EnvPilot/internal/dns/service"
	"errors"

	"gorm.io/gorm"
)

type DNSAPI struct {
	svc  *service.DNSService
	auth *authSvc.Service
}

func NewDNSAPI(svc *service.DNSService, auth *authSvc.Service) *DNSAPI {
	return &DNSAPI{svc: svc, auth: auth}
}

func (a *DNSAPI) requireAdmin() error {
	if a.auth == nil {
		return nil
	}
	return a.auth.RequireAdmin("")
}

type ListDNSRecordsReq struct {
	EnvironmentID uint   `json:"environment_id"`
	Keyword       string `json:"keyword"`
	Enabled       *bool  `json:"enabled"`
}

func (a *DNSAPI) ListRecords(req ListDNSRecordsReq) Result[[]model.DNSRecord] {
	list, err := a.svc.List(service.ListDNSRecordRequest{
		EnvironmentID: req.EnvironmentID,
		Keyword:       req.Keyword,
		Enabled:       req.Enabled,
	})
	if err != nil {
		return Fail[[]model.DNSRecord](err.Error())
	}
	return OK(list)
}

func (a *DNSAPI) GetRecordByAssetID(assetID uint) Result[*model.DNSRecord] {
	record, err := a.svc.GetByAssetID(assetID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return OK[*model.DNSRecord](nil)
		}
		return Fail[*model.DNSRecord](err.Error())
	}
	return OK(record)
}

type CreateDNSRecordReq struct {
	EnvironmentID uint             `json:"environment_id"`
	AssetID       *uint            `json:"asset_id"`
	Domain        string           `json:"domain"`
	RecordType    model.RecordType `json:"record_type"`
	MatchMode     model.MatchMode  `json:"match_mode"`
	Value         string           `json:"value"`
	TTL           int              `json:"ttl"`
	Enabled       bool             `json:"enabled"`
}

func (a *DNSAPI) CreateRecord(req CreateDNSRecordReq) Result[*model.DNSRecord] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*model.DNSRecord](err.Error())
	}
	record, err := a.svc.Create(service.CreateDNSRecordRequest{
		EnvironmentID: req.EnvironmentID,
		AssetID:       req.AssetID,
		Domain:        req.Domain,
		RecordType:    req.RecordType,
		MatchMode:     req.MatchMode,
		Value:         req.Value,
		TTL:           req.TTL,
		Enabled:       req.Enabled,
	})
	if err != nil {
		return Fail[*model.DNSRecord](err.Error())
	}
	return OK(record)
}

type UpdateDNSRecordReq struct {
	ID         uint             `json:"id"`
	AssetID    *uint            `json:"asset_id"`
	Domain     string           `json:"domain"`
	RecordType model.RecordType `json:"record_type"`
	MatchMode  model.MatchMode  `json:"match_mode"`
	Value      string           `json:"value"`
	TTL        int              `json:"ttl"`
	Enabled    bool             `json:"enabled"`
}

func (a *DNSAPI) UpdateRecord(req UpdateDNSRecordReq) Result[*model.DNSRecord] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*model.DNSRecord](err.Error())
	}
	record, err := a.svc.Update(service.UpdateDNSRecordRequest{
		ID:         req.ID,
		AssetID:    req.AssetID,
		Domain:     req.Domain,
		RecordType: req.RecordType,
		MatchMode:  req.MatchMode,
		Value:      req.Value,
		TTL:        req.TTL,
		Enabled:    req.Enabled,
	})
	if err != nil {
		return Fail[*model.DNSRecord](err.Error())
	}
	return OK(record)
}

func (a *DNSAPI) DeleteRecord(id uint) Result[bool] {
	if err := a.requireAdmin(); err != nil {
		return Fail[bool](err.Error())
	}
	if err := a.svc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *DNSAPI) SetRecordEnabled(id uint, enabled bool) Result[*model.DNSRecord] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*model.DNSRecord](err.Error())
	}
	record, err := a.svc.SetEnabled(id, enabled)
	if err != nil {
		return Fail[*model.DNSRecord](err.Error())
	}
	return OK(record)
}

type ListDNSQueryLogsReq struct {
	EnvironmentID uint   `json:"environment_id"`
	Keyword       string `json:"keyword"`
	Source        string `json:"source"`
	Limit         int    `json:"limit"`
	Offset        int    `json:"offset"`
}

func (a *DNSAPI) ListQueryLogs(req ListDNSQueryLogsReq) Result[*service.ListQuerySummariesResult] {
	result, err := a.svc.ListQueryLogs(service.ListQueryLogsRequest(req))
	if err != nil {
		return Fail[*service.ListQuerySummariesResult](err.Error())
	}
	return OK(result)
}

func (a *DNSAPI) GetStatus() Result[service.RuntimeStatus] {
	return OK(a.svc.GetStatus())
}
