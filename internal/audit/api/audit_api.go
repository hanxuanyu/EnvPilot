package auditapi

import auditSvc "EnvPilot/internal/audit/service"

type AuditAPI struct {
	svc *auditSvc.AuditService
}

func NewAuditAPI(svc *auditSvc.AuditService) *AuditAPI {
	return &AuditAPI{svc: svc}
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
	result, err := a.svc.List(auditSvc.ListRequest(req))
	if err != nil {
		return Fail[*auditSvc.ListResult](err.Error())
	}
	return OK(result)
}
