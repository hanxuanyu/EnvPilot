package service

import "time"

const BackupFormatVersion = "envpilot.backup.v1"

type BackupSummary struct {
	SystemSettings    int      `json:"system_settings"`
	Environments      int      `json:"environments"`
	Groups            int      `json:"groups"`
	Credentials       int      `json:"credentials"`
	Assets            int      `json:"assets"`
	DNSRecords        int      `json:"dns_records"`
	DNSQueryStats     int      `json:"dns_query_stats"`
	HealthSnapshots   int      `json:"health_snapshots"`
	Executions        int      `json:"executions"`
	AuditLogs         int      `json:"audit_logs"`
	ConfigSnapshots   int      `json:"config_snapshots"`
	SecurityFiles     []string `json:"security_files"`
	HasMasterPassword bool     `json:"has_master_password"`
}

func (s BackupSummary) HasExistingData() bool {
	if s.Environments > 0 || s.Groups > 0 || s.Credentials > 0 || s.Assets > 0 {
		return true
	}
	if s.DNSRecords > 0 || s.DNSQueryStats > 0 || s.HealthSnapshots > 0 || s.Executions > 0 {
		return true
	}
	if s.AuditLogs > 0 || s.HasMasterPassword {
		return true
	}
	return s.ConfigSnapshots > 1 || s.SystemSettings > 0
}

type BackupManifest struct {
	Format         string        `json:"format"`
	ExportedAt     time.Time     `json:"exported_at"`
	AppName        string        `json:"app_name"`
	AppVersion     string        `json:"app_version"`
	ConfigPath     string        `json:"config_path"`
	BundleFileName string        `json:"bundle_file_name"`
	Description    string        `json:"description"`
	IncludedFiles  []string      `json:"included_files"`
	Summary        BackupSummary `json:"summary"`
}

type ExportBackupResult struct {
	Filename string         `json:"filename"`
	Data     []byte         `json:"data"`
	Manifest BackupManifest `json:"manifest"`
}

type AnalyzeImportResult struct {
	Manifest      BackupManifest `json:"manifest"`
	Current       BackupSummary  `json:"current"`
	RequiresForce bool           `json:"requires_force"`
}

type ImportBackupRequest struct {
	Data     []byte `json:"data"`
	Operator string `json:"operator"`
	Force    bool   `json:"force"`
}

type ImportBackupResult struct {
	Manifest        BackupManifest `json:"manifest"`
	Current         BackupSummary  `json:"current"`
	RestartRequired bool           `json:"restart_required"`
	Warnings        []string       `json:"warnings"`
}
