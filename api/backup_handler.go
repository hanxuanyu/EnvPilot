package api

import (
	"encoding/base64"
	"net/http"

	backupSvc "EnvPilot/internal/backup/service"
)

type BackupHandler struct {
	svc *backupSvc.BackupService
}

func NewBackupHandler(svc *backupSvc.BackupService) *BackupHandler {
	return &BackupHandler{svc: svc}
}

func (h *BackupHandler) Export(w http.ResponseWriter, r *http.Request) {
	result, err := h.svc.Export()
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, map[string]any{
		"filename":    result.Filename,
		"data_base64": base64.StdEncoding.EncodeToString(result.Data),
		"manifest":    result.Manifest,
	})
}

func (h *BackupHandler) AnalyzeImport(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DataBase64 string `json:"data_base64"`
	}
	if err := decodeJSON(r, &req); err != nil || req.DataBase64 == "" {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	data, err := base64.StdEncoding.DecodeString(req.DataBase64)
	if err != nil {
		writeFail(w, http.StatusBadRequest, "导入文件读取失败")
		return
	}
	result, err := h.svc.AnalyzeImport(data)
	if err != nil {
		writeFail(w, http.StatusBadRequest, err.Error())
		return
	}
	writeOK(w, result)
}

func (h *BackupHandler) Import(w http.ResponseWriter, r *http.Request) {
	var req struct {
		DataBase64 string `json:"data_base64"`
		Operator   string `json:"operator"`
		Force      bool   `json:"force"`
	}
	if err := decodeJSON(r, &req); err != nil || req.DataBase64 == "" {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	data, err := base64.StdEncoding.DecodeString(req.DataBase64)
	if err != nil {
		writeFail(w, http.StatusBadRequest, "导入文件读取失败")
		return
	}
	result, err := h.svc.Import(backupSvc.ImportBackupRequest{
		Data:     data,
		Operator: req.Operator,
		Force:    req.Force,
	})
	if err != nil {
		writeFail(w, http.StatusBadRequest, err.Error())
		return
	}
	writeOK(w, result)
}
