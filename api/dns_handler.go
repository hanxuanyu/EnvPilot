package api

import (
	"errors"
	"net/http"

	dnsModel "EnvPilot/internal/dns/model"
	dnsSvc "EnvPilot/internal/dns/service"

	"gorm.io/gorm"
)

type DNSHandler struct {
	svc *dnsSvc.DNSService
}

func NewDNSHandler(svc *dnsSvc.DNSService) *DNSHandler {
	return &DNSHandler{svc: svc}
}

func (h *DNSHandler) ListRecords(w http.ResponseWriter, r *http.Request) {
	var enabledPtr *bool
	if raw := r.URL.Query().Get("enabled"); raw != "" {
		value := raw == "true" || raw == "1"
		enabledPtr = &value
	}

	list, err := h.svc.List(dnsSvc.ListDNSRecordRequest{
		EnvironmentID: queryUint(r, "environment_id"),
		Keyword:       r.URL.Query().Get("keyword"),
		Enabled:       enabledPtr,
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

func (h *DNSHandler) CreateRecord(w http.ResponseWriter, r *http.Request) {
	var req dnsSvc.CreateDNSRecordRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	record, err := h.svc.Create(req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, record)
}

func (h *DNSHandler) UpdateRecord(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req dnsSvc.UpdateDNSRecordRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	req.ID = id
	record, err := h.svc.Update(req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, record)
}

func (h *DNSHandler) DeleteRecord(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, true)
}

func (h *DNSHandler) SetRecordEnabled(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	record, err := h.svc.SetEnabled(id, req.Enabled)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, record)
}

func (h *DNSHandler) GetRecordByAssetID(w http.ResponseWriter, r *http.Request) {
	assetID, err := pathUint(r, "asset_id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的资产 ID")
		return
	}
	record, err := h.svc.GetByAssetID(assetID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			writeOK[*dnsModel.DNSRecord](w, nil)
			return
		}
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, record)
}

func (h *DNSHandler) ListQueryLogs(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.ListQueryLogs(dnsSvc.ListQueryLogsRequest{
		EnvironmentID: queryUint(r, "environment_id"),
		Keyword:       r.URL.Query().Get("keyword"),
		Source:        r.URL.Query().Get("source"),
		Limit:         queryInt(r, "limit", 100),
		Offset:        queryInt(r, "offset", 0),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *DNSHandler) GetStatus(w http.ResponseWriter, r *http.Request) {
	writeOK(w, h.svc.GetStatus())
}
