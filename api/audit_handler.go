package api

import (
	"net/http"

	auditSvc "EnvPilot/internal/audit/service"
)

type AuditHandler struct {
	svc *auditSvc.AuditService
}

func NewAuditHandler(svc *auditSvc.AuditService) *AuditHandler {
	return &AuditHandler{svc: svc}
}

func (h *AuditHandler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	var successPtr *bool
	if raw := r.URL.Query().Get("success"); raw != "" {
		value := raw == "true" || raw == "1"
		successPtr = &value
	}

	result, err := h.svc.List(auditSvc.ListRequest{
		Module:     r.URL.Query().Get("module"),
		Action:     r.URL.Query().Get("action"),
		PluginType: r.URL.Query().Get("plugin_type"),
		Success:    successPtr,
		Keyword:    r.URL.Query().Get("keyword"),
		Limit:      queryInt(r, "limit", 50),
		Offset:     queryInt(r, "offset", 0),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *AuditHandler) CleanupAuditLogs(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.CleanupNow()
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}
