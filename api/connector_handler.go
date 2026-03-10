package api

import (
	"net/http"

	connectorSvc "EnvPilot/internal/connector/service"
)

type ConnectorHandler struct {
	svc *connectorSvc.ConnectorService
}

func NewConnectorHandler(svc *connectorSvc.ConnectorService) *ConnectorHandler {
	return &ConnectorHandler{svc: svc}
}

// GET /api/connectors/{id}/catalog
func (h *ConnectorHandler) GetDatabaseCatalog(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}

	catalog, err := h.svc.GetDatabaseCatalog(r.Context(), id)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, catalog)
}

// POST /api/connectors/test
func (h *ConnectorHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AssetID uint `json:"asset_id"`
	}
	if err := decodeJSON(r, &req); err != nil || req.AssetID == 0 {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	if err := h.svc.TestConnection(r.Context(), req.AssetID); err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, true)
}

// GET /api/connectors/{id}/databases
func (h *ConnectorHandler) ListDatabases(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}

	list, err := h.svc.ListDatabases(r.Context(), id)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

// GET /api/connectors/{id}/tables?database=
func (h *ConnectorHandler) ListTables(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}

	list, err := h.svc.ListTables(r.Context(), id, r.URL.Query().Get("database"))
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

// POST /api/connectors/table-detail
func (h *ConnectorHandler) GetTableDetail(w http.ResponseWriter, r *http.Request) {
	var req connectorSvc.TableDetailRequest
	if err := decodeJSON(r, &req); err != nil || req.AssetID == 0 || req.Table == "" {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	result, err := h.svc.GetTableDetail(r.Context(), req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

// POST /api/connectors/sql
func (h *ConnectorHandler) ExecuteSQL(w http.ResponseWriter, r *http.Request) {
	var req connectorSvc.ExecuteSQLRequest
	if err := decodeJSON(r, &req); err != nil || req.AssetID == 0 {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	result, err := h.svc.ExecuteSQL(r.Context(), req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

// POST /api/connectors/redis
func (h *ConnectorHandler) ExecuteRedisCmd(w http.ResponseWriter, r *http.Request) {
	var req connectorSvc.ExecuteRedisCommandRequest
	if err := decodeJSON(r, &req); err != nil || req.AssetID == 0 {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	result, err := h.svc.ExecuteRedisCommand(r.Context(), req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

// POST /api/connectors/mq
func (h *ConnectorHandler) SendMQMessage(w http.ResponseWriter, r *http.Request) {
	var req connectorSvc.SendMQMessageRequest
	if err := decodeJSON(r, &req); err != nil || req.AssetID == 0 {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}

	result, err := h.svc.SendMQMessage(r.Context(), req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}
