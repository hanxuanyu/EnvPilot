package api

import (
	"net/http"

	configSvc "EnvPilot/internal/config/service"
)

type ConfigHandler struct {
	svc *configSvc.ConfigService
}

func NewConfigHandler(svc *configSvc.ConfigService) *ConfigHandler {
	return &ConfigHandler{svc: svc}
}

func (h *ConfigHandler) GetCurrent(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.GetCurrent()
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *ConfigHandler) Update(w http.ResponseWriter, r *http.Request) {
	var req configSvc.UpdateRawConfigRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	result, err := h.svc.UpdateRaw(req)
	if err != nil {
		writeFail(w, http.StatusBadRequest, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *ConfigHandler) ListSnapshots(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.ListSnapshots(configSvc.ListSnapshotsRequest{
		Limit:  queryInt(r, "limit", 20),
		Offset: queryInt(r, "offset", 0),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *ConfigHandler) GetSnapshot(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的快照 ID")
		return
	}
	result, err := h.svc.GetSnapshot(id)
	if err != nil {
		writeFail(w, http.StatusNotFound, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *ConfigHandler) Rollback(w http.ResponseWriter, r *http.Request) {
	var req configSvc.RollbackConfigRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	result, err := h.svc.Rollback(req)
	if err != nil {
		writeFail(w, http.StatusBadRequest, err.Error())
		return
	}
	writeOK(w, result)
}
