package api

import (
	"net/http"

	healthModel "EnvPilot/internal/health/model"
	healthSvc "EnvPilot/internal/health/service"
	"EnvPilot/internal/plugin"
)

type HealthHandler struct {
	svc *healthSvc.HealthService
}

func NewHealthHandler(svc *healthSvc.HealthService) *HealthHandler {
	return &HealthHandler{svc: svc}
}

func (h *HealthHandler) ListSnapshots(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.ListSnapshots(healthSvc.ListSnapshotsRequest{
		EnvironmentID: queryUint(r, "environment_id"),
		Category:      plugin.AssetCategory(r.URL.Query().Get("category")),
		Status:        healthModel.HealthStatus(r.URL.Query().Get("status")),
		Keyword:       r.URL.Query().Get("keyword"),
		Limit:         queryInt(r, "limit", 20),
		Offset:        queryInt(r, "offset", 0),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *HealthHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.GetSummary(healthSvc.ListSnapshotsRequest{
		EnvironmentID: queryUint(r, "environment_id"),
		Category:      plugin.AssetCategory(r.URL.Query().Get("category")),
		Status:        healthModel.HealthStatus(r.URL.Query().Get("status")),
		Keyword:       r.URL.Query().Get("keyword"),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *HealthHandler) CheckAsset(w http.ResponseWriter, r *http.Request) {
	assetID, err := pathUint(r, "asset_id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的资产 ID")
		return
	}
	result, err := h.svc.CheckAsset(r.Context(), assetID)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *HealthHandler) CheckAll(w http.ResponseWriter, r *http.Request) {
	var req healthSvc.CheckAllRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	result, err := h.svc.CheckAll(r.Context(), req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}
