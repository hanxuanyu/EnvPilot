package backupapi

import (
	"encoding/base64"

	authSvc "EnvPilot/internal/auth/service"
	backupSvc "EnvPilot/internal/backup/service"
)

type BackupAPI struct {
	svc  *backupSvc.BackupService
	auth *authSvc.Service
}

type ExportBackupResult struct {
	Filename   string                   `json:"filename"`
	DataBase64 string                   `json:"data_base64"`
	Manifest   backupSvc.BackupManifest `json:"manifest"`
}

type AnalyzeImportReq struct {
	DataBase64 string `json:"data_base64"`
}

type ImportBackupReq struct {
	DataBase64 string `json:"data_base64"`
	Operator   string `json:"operator"`
	Force      bool   `json:"force"`
}

func NewBackupAPI(svc *backupSvc.BackupService, auth *authSvc.Service) *BackupAPI {
	return &BackupAPI{svc: svc, auth: auth}
}

func (a *BackupAPI) requireAdmin() error {
	if a.auth == nil {
		return nil
	}
	return a.auth.RequireAdmin("")
}

func (a *BackupAPI) ExportBackup() Result[*ExportBackupResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*ExportBackupResult](err.Error())
	}
	result, err := a.svc.Export()
	if err != nil {
		return Fail[*ExportBackupResult](err.Error())
	}
	return OK(&ExportBackupResult{
		Filename:   result.Filename,
		DataBase64: base64.StdEncoding.EncodeToString(result.Data),
		Manifest:   result.Manifest,
	})
}

func (a *BackupAPI) AnalyzeImportBackup(req AnalyzeImportReq) Result[*backupSvc.AnalyzeImportResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*backupSvc.AnalyzeImportResult](err.Error())
	}
	data, err := base64.StdEncoding.DecodeString(req.DataBase64)
	if err != nil {
		return Fail[*backupSvc.AnalyzeImportResult]("导入文件读取失败")
	}
	result, err := a.svc.AnalyzeImport(data)
	if err != nil {
		return Fail[*backupSvc.AnalyzeImportResult](err.Error())
	}
	return OK(result)
}

func (a *BackupAPI) ImportBackup(req ImportBackupReq) Result[*backupSvc.ImportBackupResult] {
	if err := a.requireAdmin(); err != nil {
		return Fail[*backupSvc.ImportBackupResult](err.Error())
	}
	data, err := base64.StdEncoding.DecodeString(req.DataBase64)
	if err != nil {
		return Fail[*backupSvc.ImportBackupResult]("导入文件读取失败")
	}
	result, err := a.svc.Import(backupSvc.ImportBackupRequest{
		Data:     data,
		Operator: req.Operator,
		Force:    req.Force,
	})
	if err != nil {
		return Fail[*backupSvc.ImportBackupResult](err.Error())
	}
	return OK(result)
}
