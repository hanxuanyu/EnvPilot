package auditapi

import (
	auditSvc "EnvPilot/internal/audit/service"
	authSvc "EnvPilot/internal/auth/service"
)

type AuditAPI struct {
	svc  *auditSvc.AuditService
	auth *authSvc.Service
}

func NewAuditAPI(svc *auditSvc.AuditService, auth *authSvc.Service) *AuditAPI {
	return &AuditAPI{svc: svc, auth: auth}
}

func (a *AuditAPI) requireProtectedPage() error {
	if a.auth == nil {
		return nil
	}
	return a.auth.RequireProtectedPage("")
}

func (a *AuditAPI) requireAdmin() error {
	if a.auth == nil {
		return nil
	}
	return a.auth.RequireAdmin("")
}

type ListAuditLogsReq struct {
	Module     string `json:"module"`
	Action     string `json:"action"`
	PluginType string `json:"plugin_type"`
	Success    *bool  `json:"success"`
	Keyword    string `json:"keyword"`
	Limit      int    `json:"limit"`
	Offset     int    `json:"offset"`
}

func (a *AuditAPI) ListAuditLogs(req ListAuditLogsReq) Result[*auditSvc.ListResult] {
	if err := a.requireProtectedPage(); err != nil {
		return Fail[*auditSvc.ListResult](err.Error())
	}
	result, err := a.svc.List(auditSvc.ListRequest(req))
	if err != nil {
		return Fail[*auditSvc.ListResult](err.Error())
	}
	return OK(result)
}

func (a *AuditAPI) CleanupAuditLogs() Result[*auditSvc.CleanupResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*auditSvc.CleanupResult](err.Error())
	}
	result, err := a.svc.CleanupNow()
	if err != nil {
		return Fail[*auditSvc.CleanupResult](err.Error())
	}
	return OK(result)
}
