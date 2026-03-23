package service

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"EnvPilot/database"
	"EnvPilot/database/migration"
	assetModel "EnvPilot/internal/asset/model"
	auditSvc "EnvPilot/internal/audit/service"
	configModel "EnvPilot/internal/config/model"
	configSvc "EnvPilot/internal/config/service"
	dnsModel "EnvPilot/internal/dns/model"
	executorModel "EnvPilot/internal/executor/model"
	healthModel "EnvPilot/internal/health/model"
	"EnvPilot/pkg/buildinfo"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	manifestFilePath            = "manifest.json"
	readmeFilePath              = "README.txt"
	configFilePath              = "config/config.yaml"
	systemSettingsFilePath      = "data/system/settings.json"
	environmentsFilePath        = "data/assets/environments.json"
	groupsFilePath              = "data/assets/groups.json"
	credentialsFilePath         = "data/assets/credentials.json"
	assetsFilePath              = "data/assets/assets.json"
	dnsRecordsFilePath          = "data/dns/records.json"
	dnsQueryStatsFilePath       = "data/dns/query_stats.json"
	healthSnapshotsFilePath     = "data/health/snapshots.json"
	executionsFilePath          = "data/executor/executions.json"
	auditLogsFilePath           = "data/audit/logs.json"
	configSnapshotsFilePath     = "data/config/snapshots.json"
	saltFilePath                = "security/salt.base64.txt"
	masterPasswordStateFilePath = "security/master_password_state.json"
)

var errImportForceRequired = errors.New("当前应用已存在数据，导入前请再次确认")

type BackupService struct {
	db     *gorm.DB
	config *configSvc.ConfigService
	audit  *auditSvc.AuditService
}

type systemSetting struct {
	Key       string `gorm:"primaryKey;size:100" json:"key"`
	Value     string `gorm:"type:text" json:"value"`
	UpdatedAt int64  `gorm:"autoUpdateTime" json:"updated_at"`
}

func (systemSetting) TableName() string {
	return "system_settings"
}

type backupBundle struct {
	Manifest        BackupManifest
	ConfigYAML      []byte
	SystemSettings  []systemSetting
	Environments    []assetModel.Environment
	Groups          []assetModel.Group
	Credentials     []assetModel.Credential
	Assets          []assetModel.Asset
	DNSRecords      []dnsModel.DNSRecord
	DNSQueryStats   []dnsModel.DNSQuerySummary
	HealthSnapshots []healthModel.HealthSnapshot
	Executions      []executorModel.Execution
	AuditLogs       []auditLogModel
	ConfigSnapshots []configModel.ConfigSnapshot
	Salt            []byte
	MasterPassState []byte
}

type auditLogModel struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Module       string    `gorm:"size:64;index" json:"module"`
	Action       string    `gorm:"size:64;index" json:"action"`
	ResourceType string    `gorm:"size:64;index" json:"resource_type"`
	ResourceID   *uint     `gorm:"index" json:"resource_id,omitempty"`
	ResourceName string    `gorm:"size:255" json:"resource_name,omitempty"`
	PluginType   string    `gorm:"size:64;index" json:"plugin_type,omitempty"`
	Operator     string    `gorm:"size:100;index" json:"operator,omitempty"`
	Success      bool      `gorm:"index" json:"success"`
	Detail       string    `gorm:"type:text" json:"detail,omitempty"`
	RequestData  string    `gorm:"type:text" json:"request_data,omitempty"`
	ResultData   string    `gorm:"type:text" json:"result_data,omitempty"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

func (auditLogModel) TableName() string {
	return "audit_logs"
}

func NewBackupService(db *gorm.DB, config *configSvc.ConfigService, audit *auditSvc.AuditService) *BackupService {
	return &BackupService{db: db, config: config, audit: audit}
}

func (s *BackupService) Export() (*ExportBackupResult, error) {
	if s.db == nil || s.config == nil {
		return nil, fmt.Errorf("备份服务尚未初始化")
	}

	current, err := s.config.GetCurrent()
	if err != nil {
		return nil, err
	}
	bundle, err := s.collectBundle([]byte(current.YAML))
	if err != nil {
		return nil, err
	}

	filename := fmt.Sprintf("envpilot-backup-%s.zip", time.Now().UTC().Format("20060102-150405"))
	manifest := bundle.Manifest
	manifest.BundleFileName = filename
	bundle.Manifest = manifest

	data, err := buildBackupArchive(bundle)
	if err != nil {
		return nil, err
	}

	s.recordAudit(auditSvc.RecordInput{
		Module:       "backup",
		Action:       "export_backup",
		ResourceType: "backup",
		Operator:     "admin",
		Success:      true,
		Detail:       "已导出全量备份包",
		Result: map[string]any{
			"filename": filename,
			"summary":  manifest.Summary,
		},
	})

	return &ExportBackupResult{
		Filename: filename,
		Data:     data,
		Manifest: manifest,
	}, nil
}

func (s *BackupService) AnalyzeImport(data []byte) (*AnalyzeImportResult, error) {
	bundle, err := parseBackupArchive(data)
	if err != nil {
		return nil, err
	}
	current, err := s.currentSummary()
	if err != nil {
		return nil, err
	}
	return &AnalyzeImportResult{
		Manifest:      bundle.Manifest,
		Current:       current,
		RequiresForce: current.HasExistingData(),
	}, nil
}

func (s *BackupService) Import(req ImportBackupRequest) (*ImportBackupResult, error) {
	if s.db == nil || s.config == nil {
		return nil, fmt.Errorf("备份服务尚未初始化")
	}

	bundle, err := parseBackupArchive(req.Data)
	if err != nil {
		return nil, err
	}
	current, err := s.currentSummary()
	if err != nil {
		return nil, err
	}
	if current.HasExistingData() && !req.Force {
		return nil, errImportForceRequired
	}

	currentConfig := s.config.Get()
	if currentConfig == nil {
		return nil, fmt.Errorf("当前配置未加载")
	}
	warnings := compareImportedTarget(currentConfig, s.config.GetConfigPath(), bundle.ConfigYAML)

	if err := restoreBundleToDB(s.db, bundle); err != nil {
		return nil, err
	}

	if err := s.syncSecurityFiles(currentConfig, bundle.ConfigYAML, bundle.Salt, bundle.MasterPassState); err != nil {
		return nil, err
	}
	if err := s.config.WriteRawConfigFile(bundle.ConfigYAML); err != nil {
		return nil, err
	}
	if err := s.config.Load(); err != nil {
		return nil, fmt.Errorf("重载导入后的配置失败: %w", err)
	}
	if cfg := s.config.Get(); cfg != nil {
		cfg.App.DataDir = effectiveDataDir(s.config.GetConfigPath(), cfg.App.DataDir)
	}

	operator := strings.TrimSpace(req.Operator)
	if operator == "" {
		operator = "admin"
	}
	s.recordAudit(auditSvc.RecordInput{
		Module:       "backup",
		Action:       "import_backup",
		ResourceType: "backup",
		Operator:     operator,
		Success:      true,
		Detail:       "已导入全量备份包并覆盖现有数据",
		Request: map[string]any{
			"force": current.HasExistingData(),
		},
		Result: map[string]any{
			"summary":  bundle.Manifest.Summary,
			"warnings": warnings,
		},
	})

	return &ImportBackupResult{
		Manifest:        bundle.Manifest,
		Current:         current,
		RestartRequired: true,
		Warnings:        warnings,
	}, nil
}

func (s *BackupService) collectBundle(configYAML []byte) (*backupBundle, error) {
	systemSettings, err := listRecords[systemSetting](s.db, "key")
	if err != nil {
		return nil, fmt.Errorf("读取系统设置失败: %w", err)
	}
	environments, err := listRecords[assetModel.Environment](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取环境数据失败: %w", err)
	}
	groups, err := listRecords[assetModel.Group](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取分组数据失败: %w", err)
	}
	credentials, err := listRecords[assetModel.Credential](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取凭据数据失败: %w", err)
	}
	assets, err := listRecords[assetModel.Asset](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取资产数据失败: %w", err)
	}
	dnsRecords, err := listRecords[dnsModel.DNSRecord](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取 DNS 记录失败: %w", err)
	}
	dnsQueryStats, err := listRecords[dnsModel.DNSQuerySummary](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取 DNS 统计失败: %w", err)
	}
	healthSnapshots, err := listRecords[healthModel.HealthSnapshot](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取健康快照失败: %w", err)
	}
	executions, err := listRecords[executorModel.Execution](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取执行记录失败: %w", err)
	}
	auditLogs, err := listRecords[auditLogModel](s.db, "id")
	if err != nil {
		return nil, fmt.Errorf("读取审计日志失败: %w", err)
	}
	configSnapshots, err := listRecords[configModel.ConfigSnapshot](s.db, "version")
	if err != nil {
		return nil, fmt.Errorf("读取配置快照失败: %w", err)
	}

	currentCfg := s.config.Get()
	if currentCfg == nil {
		return nil, fmt.Errorf("当前配置未加载")
	}
	currentDataDir := effectiveDataDir(s.config.GetConfigPath(), currentCfg.App.DataDir)
	saltPath := filepath.Join(currentDataDir, currentCfg.Security.SaltFile)
	salt, err := os.ReadFile(saltPath)
	if err != nil {
		return nil, fmt.Errorf("读取安全盐文件失败 [%s]: %w", saltPath, err)
	}
	masterPassPath := filepath.Join(currentDataDir, ".masterpass")
	masterPassState, err := os.ReadFile(masterPassPath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("读取主密码状态失败 [%s]: %w", masterPassPath, err)
	}

	summary := BackupSummary{
		SystemSettings:    len(systemSettings),
		Environments:      len(environments),
		Groups:            len(groups),
		Credentials:       len(credentials),
		Assets:            len(assets),
		DNSRecords:        len(dnsRecords),
		DNSQueryStats:     len(dnsQueryStats),
		HealthSnapshots:   len(healthSnapshots),
		Executions:        len(executions),
		AuditLogs:         len(auditLogs),
		ConfigSnapshots:   len(configSnapshots),
		SecurityFiles:     collectSecurityFiles(len(salt) > 0, len(masterPassState) > 0),
		HasMasterPassword: len(masterPassState) > 0,
	}

	includedFiles := []string{
		manifestFilePath,
		readmeFilePath,
		configFilePath,
		systemSettingsFilePath,
		environmentsFilePath,
		groupsFilePath,
		credentialsFilePath,
		assetsFilePath,
		dnsRecordsFilePath,
		dnsQueryStatsFilePath,
		healthSnapshotsFilePath,
		executionsFilePath,
		auditLogsFilePath,
		configSnapshotsFilePath,
		saltFilePath,
	}
	if len(masterPassState) > 0 {
		includedFiles = append(includedFiles, masterPasswordStateFilePath)
	}
	sort.Strings(includedFiles)

	return &backupBundle{
		Manifest: BackupManifest{
			Format:        BackupFormatVersion,
			ExportedAt:    time.Now().UTC(),
			AppName:       currentCfg.App.Name,
			AppVersion:    buildinfo.NormalizedVersion(),
			ConfigPath:    s.config.GetConfigPath(),
			Description:   "EnvPilot 全量备份包，包含配置、安全文件与核心业务数据",
			IncludedFiles: includedFiles,
			Summary:       summary,
		},
		ConfigYAML:      append([]byte(nil), configYAML...),
		SystemSettings:  systemSettings,
		Environments:    environments,
		Groups:          groups,
		Credentials:     credentials,
		Assets:          assets,
		DNSRecords:      dnsRecords,
		DNSQueryStats:   dnsQueryStats,
		HealthSnapshots: healthSnapshots,
		Executions:      executions,
		AuditLogs:       auditLogs,
		ConfigSnapshots: configSnapshots,
		Salt:            append([]byte(nil), salt...),
		MasterPassState: append([]byte(nil), masterPassState...),
	}, nil
}

func (s *BackupService) currentSummary() (BackupSummary, error) {
	countSettings, err := countRecords[systemSetting](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countEnvironments, err := countRecords[assetModel.Environment](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countGroups, err := countRecords[assetModel.Group](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countCredentials, err := countRecords[assetModel.Credential](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countAssets, err := countRecords[assetModel.Asset](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countDNSRecords, err := countRecords[dnsModel.DNSRecord](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countDNSQueryStats, err := countRecords[dnsModel.DNSQuerySummary](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countHealthSnapshots, err := countRecords[healthModel.HealthSnapshot](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countExecutions, err := countRecords[executorModel.Execution](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countAuditLogs, err := countRecords[auditLogModel](s.db)
	if err != nil {
		return BackupSummary{}, err
	}
	countConfigSnapshots, err := countRecords[configModel.ConfigSnapshot](s.db)
	if err != nil {
		return BackupSummary{}, err
	}

	cfg := s.config.Get()
	if cfg == nil {
		return BackupSummary{}, fmt.Errorf("当前配置未加载")
	}
	currentDataDir := effectiveDataDir(s.config.GetConfigPath(), cfg.App.DataDir)
	saltPath := filepath.Join(currentDataDir, cfg.Security.SaltFile)
	_, saltErr := os.Stat(saltPath)
	masterPassPath := filepath.Join(currentDataDir, ".masterpass")
	_, masterPassErr := os.Stat(masterPassPath)

	return BackupSummary{
		SystemSettings:    int(countSettings),
		Environments:      int(countEnvironments),
		Groups:            int(countGroups),
		Credentials:       int(countCredentials),
		Assets:            int(countAssets),
		DNSRecords:        int(countDNSRecords),
		DNSQueryStats:     int(countDNSQueryStats),
		HealthSnapshots:   int(countHealthSnapshots),
		Executions:        int(countExecutions),
		AuditLogs:         int(countAuditLogs),
		ConfigSnapshots:   int(countConfigSnapshots),
		SecurityFiles:     collectSecurityFiles(saltErr == nil, masterPassErr == nil),
		HasMasterPassword: masterPassErr == nil,
	}, nil
}

func (s *BackupService) syncSecurityFiles(currentCfg *configModel.AppConfig, importedYAML, salt, masterPass []byte) error {
	importedCfg, err := configSvc.ParseConfigBytes(importedYAML)
	if err != nil {
		return err
	}

	currentDataDir := effectiveDataDir(s.config.GetConfigPath(), currentCfg.App.DataDir)
	targetDataDir := resolveImportedDataDir(s.config.GetConfigPath(), importedCfg.App.DataDir)
	paths := uniqueStrings([]string{
		filepath.Join(currentDataDir, currentCfg.Security.SaltFile),
		filepath.Join(targetDataDir, importedCfg.Security.SaltFile),
	})
	for _, path := range paths {
		if err := writeSensitiveFile(path, salt); err != nil {
			return err
		}
	}

	masterPaths := uniqueStrings([]string{
		filepath.Join(currentDataDir, ".masterpass"),
		filepath.Join(targetDataDir, ".masterpass"),
	})
	if len(masterPass) == 0 {
		for _, path := range masterPaths {
			if err := removeIfExists(path); err != nil {
				return err
			}
		}
		return nil
	}
	for _, path := range masterPaths {
		if err := writeSensitiveFile(path, masterPass); err != nil {
			return err
		}
	}
	return nil
}

func buildBackupArchive(bundle *backupBundle) ([]byte, error) {
	var buf bytes.Buffer
	zipWriter := zip.NewWriter(&buf)

	if err := writeZipJSON(zipWriter, manifestFilePath, bundle.Manifest); err != nil {
		return nil, err
	}
	if err := writeZipText(zipWriter, readmeFilePath, buildReadme(bundle.Manifest)); err != nil {
		return nil, err
	}
	if err := writeZipBytes(zipWriter, configFilePath, bundle.ConfigYAML); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, systemSettingsFilePath, bundle.SystemSettings); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, environmentsFilePath, bundle.Environments); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, groupsFilePath, bundle.Groups); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, credentialsFilePath, bundle.Credentials); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, assetsFilePath, bundle.Assets); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, dnsRecordsFilePath, bundle.DNSRecords); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, dnsQueryStatsFilePath, bundle.DNSQueryStats); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, healthSnapshotsFilePath, bundle.HealthSnapshots); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, executionsFilePath, bundle.Executions); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, auditLogsFilePath, bundle.AuditLogs); err != nil {
		return nil, err
	}
	if err := writeZipJSON(zipWriter, configSnapshotsFilePath, bundle.ConfigSnapshots); err != nil {
		return nil, err
	}
	if err := writeZipText(zipWriter, saltFilePath, base64.StdEncoding.EncodeToString(bundle.Salt)); err != nil {
		return nil, err
	}
	if len(bundle.MasterPassState) > 0 {
		if err := writeZipBytes(zipWriter, masterPasswordStateFilePath, bundle.MasterPassState); err != nil {
			return nil, err
		}
	}
	if err := zipWriter.Close(); err != nil {
		return nil, fmt.Errorf("写入备份压缩包失败: %w", err)
	}
	return buf.Bytes(), nil
}

func parseBackupArchive(data []byte) (*backupBundle, error) {
	reader, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("解析备份压缩包失败: %w", err)
	}

	files := make(map[string][]byte, len(reader.File))
	for _, file := range reader.File {
		content, readErr := readZipFile(file)
		if readErr != nil {
			return nil, readErr
		}
		files[file.Name] = content
	}

	manifestData, ok := files[manifestFilePath]
	if !ok {
		return nil, fmt.Errorf("备份包缺少 %s", manifestFilePath)
	}
	var manifest BackupManifest
	if err := json.Unmarshal(manifestData, &manifest); err != nil {
		return nil, fmt.Errorf("解析备份清单失败: %w", err)
	}
	if manifest.Format != BackupFormatVersion {
		return nil, fmt.Errorf("不支持的备份格式: %s", manifest.Format)
	}

	configYAML, ok := files[configFilePath]
	if !ok {
		return nil, fmt.Errorf("备份包缺少 %s", configFilePath)
	}
	if _, err := configSvc.ParseConfigBytes(configYAML); err != nil {
		return nil, fmt.Errorf("备份包配置内容无效: %w", err)
	}

	systemSettings, err := parseZipJSON[systemSetting](files, systemSettingsFilePath, true)
	if err != nil {
		return nil, err
	}
	environments, err := parseZipJSON[assetModel.Environment](files, environmentsFilePath, true)
	if err != nil {
		return nil, err
	}
	groups, err := parseZipJSON[assetModel.Group](files, groupsFilePath, true)
	if err != nil {
		return nil, err
	}
	credentials, err := parseZipJSON[assetModel.Credential](files, credentialsFilePath, true)
	if err != nil {
		return nil, err
	}
	assets, err := parseZipJSON[assetModel.Asset](files, assetsFilePath, true)
	if err != nil {
		return nil, err
	}
	dnsRecords, err := parseZipJSON[dnsModel.DNSRecord](files, dnsRecordsFilePath, true)
	if err != nil {
		return nil, err
	}
	dnsQueryStats, err := parseZipJSON[dnsModel.DNSQuerySummary](files, dnsQueryStatsFilePath, true)
	if err != nil {
		return nil, err
	}
	healthSnapshots, err := parseZipJSON[healthModel.HealthSnapshot](files, healthSnapshotsFilePath, true)
	if err != nil {
		return nil, err
	}
	executions, err := parseZipJSON[executorModel.Execution](files, executionsFilePath, true)
	if err != nil {
		return nil, err
	}
	auditLogs, err := parseZipJSON[auditLogModel](files, auditLogsFilePath, true)
	if err != nil {
		return nil, err
	}
	configSnapshots, err := parseZipJSON[configModel.ConfigSnapshot](files, configSnapshotsFilePath, true)
	if err != nil {
		return nil, err
	}

	saltText, ok := files[saltFilePath]
	if !ok {
		return nil, fmt.Errorf("备份包缺少 %s", saltFilePath)
	}
	salt, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(saltText)))
	if err != nil {
		return nil, fmt.Errorf("解析安全盐失败: %w", err)
	}

	masterPassState := append([]byte(nil), files[masterPasswordStateFilePath]...)

	return &backupBundle{
		Manifest:        manifest,
		ConfigYAML:      append([]byte(nil), configYAML...),
		SystemSettings:  systemSettings,
		Environments:    environments,
		Groups:          groups,
		Credentials:     credentials,
		Assets:          assets,
		DNSRecords:      dnsRecords,
		DNSQueryStats:   dnsQueryStats,
		HealthSnapshots: healthSnapshots,
		Executions:      executions,
		AuditLogs:       auditLogs,
		ConfigSnapshots: configSnapshots,
		Salt:            salt,
		MasterPassState: masterPassState,
	}, nil
}

func restoreBundleToDB(db *gorm.DB, bundle *backupBundle) error {
	if db == nil {
		return fmt.Errorf("数据库连接未初始化")
	}
	if err := migration.NewMigrator(db).Run(); err != nil {
		return fmt.Errorf("确保数据库结构失败: %w", err)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		deleteModels := []any{
			&healthModel.HealthSnapshot{},
			&executorModel.Execution{},
			&auditLogModel{},
			&dnsModel.DNSQuerySummary{},
			&dnsModel.DNSRecord{},
			&assetModel.Asset{},
			&assetModel.Credential{},
			&assetModel.Group{},
			&assetModel.Environment{},
			&configModel.ConfigSnapshot{},
			&systemSetting{},
		}
		for _, model := range deleteModels {
			if err := tx.Session(&gorm.Session{AllowGlobalUpdate: true}).Delete(model).Error; err != nil {
				return fmt.Errorf("清空现有数据失败: %w", err)
			}
		}

		if err := createAll(tx, bundle.SystemSettings); err != nil {
			return fmt.Errorf("恢复系统设置失败: %w", err)
		}
		if err := createAll(tx, bundle.Environments); err != nil {
			return fmt.Errorf("恢复环境失败: %w", err)
		}
		if err := createAll(tx, bundle.Groups); err != nil {
			return fmt.Errorf("恢复分组失败: %w", err)
		}
		if err := createAll(tx, bundle.Credentials); err != nil {
			return fmt.Errorf("恢复凭据失败: %w", err)
		}
		if err := createAll(tx, bundle.Assets); err != nil {
			return fmt.Errorf("恢复资产失败: %w", err)
		}
		if err := createAll(tx, bundle.DNSRecords); err != nil {
			return fmt.Errorf("恢复 DNS 记录失败: %w", err)
		}
		if err := createAll(tx, bundle.DNSQueryStats); err != nil {
			return fmt.Errorf("恢复 DNS 统计失败: %w", err)
		}
		if err := createAll(tx, bundle.HealthSnapshots); err != nil {
			return fmt.Errorf("恢复健康快照失败: %w", err)
		}
		if err := createAll(tx, bundle.Executions); err != nil {
			return fmt.Errorf("恢复执行记录失败: %w", err)
		}
		if err := createAll(tx, bundle.AuditLogs); err != nil {
			return fmt.Errorf("恢复审计日志失败: %w", err)
		}
		if err := createAll(tx, bundle.ConfigSnapshots); err != nil {
			return fmt.Errorf("恢复配置快照失败: %w", err)
		}
		return nil
	})
}

func listRecords[T any](db *gorm.DB, orderBy string) ([]T, error) {
	var items []T
	query := db
	if strings.TrimSpace(orderBy) != "" {
		query = query.Order(clause.OrderByColumn{
			Column: clause.Column{Name: orderBy},
			Desc:   false,
		})
	}
	if err := query.Find(&items).Error; err != nil {
		return nil, err
	}
	if items == nil {
		items = []T{}
	}
	return items, nil
}

func countRecords[T any](db *gorm.DB) (int64, error) {
	var count int64
	if err := db.Model(new(T)).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func createAll[T any](tx *gorm.DB, items []T) error {
	if len(items) == 0 {
		return nil
	}
	return tx.Create(&items).Error
}

func parseZipJSON[T any](files map[string][]byte, path string, required bool) ([]T, error) {
	content, ok := files[path]
	if !ok {
		if required {
			return nil, fmt.Errorf("备份包缺少 %s", path)
		}
		return []T{}, nil
	}
	var items []T
	if err := json.Unmarshal(content, &items); err != nil {
		return nil, fmt.Errorf("解析备份文件失败 [%s]: %w", path, err)
	}
	if items == nil {
		items = []T{}
	}
	return items, nil
}

func writeZipJSON(zipWriter *zip.Writer, path string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化备份文件失败 [%s]: %w", path, err)
	}
	data = append(data, '\n')
	return writeZipBytes(zipWriter, path, data)
}

func writeZipText(zipWriter *zip.Writer, path string, value string) error {
	return writeZipBytes(zipWriter, path, []byte(value))
}

func writeZipBytes(zipWriter *zip.Writer, path string, data []byte) error {
	writer, err := zipWriter.Create(path)
	if err != nil {
		return fmt.Errorf("创建备份文件失败 [%s]: %w", path, err)
	}
	if _, err := writer.Write(data); err != nil {
		return fmt.Errorf("写入备份文件失败 [%s]: %w", path, err)
	}
	return nil
}

func readZipFile(file *zip.File) ([]byte, error) {
	reader, err := file.Open()
	if err != nil {
		return nil, fmt.Errorf("读取备份文件失败 [%s]: %w", file.Name, err)
	}
	defer reader.Close()
	content, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("读取备份文件失败 [%s]: %w", file.Name, err)
	}
	return content, nil
}

func buildReadme(manifest BackupManifest) string {
	return fmt.Sprintf(
		"EnvPilot 全量备份包\n\n导出时间: %s\n应用版本: %s\n\n结构说明:\n- manifest.json: 备份清单与摘要\n- config/config.yaml: 当前应用配置\n- security/: 安全相关文件\n- data/: 按模块拆分后的 JSON 数据\n",
		manifest.ExportedAt.Format(time.RFC3339),
		manifest.AppVersion,
	)
}

func writeSensitiveFile(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("创建安全文件目录失败 [%s]: %w", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		return fmt.Errorf("写入安全文件失败 [%s]: %w", path, err)
	}
	return nil
}

func removeIfExists(path string) error {
	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("删除旧安全文件失败 [%s]: %w", path, err)
	}
	return nil
}

func collectSecurityFiles(hasSalt bool, hasMasterPass bool) []string {
	files := make([]string, 0, 2)
	if hasSalt {
		files = append(files, "salt")
	}
	if hasMasterPass {
		files = append(files, "master_password_state")
	}
	return files
}

func uniqueStrings(values []string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func resolveImportedDataDir(configPath string, importedDataDir string) string {
	if filepath.IsAbs(importedDataDir) {
		return filepath.Clean(importedDataDir)
	}
	return filepath.Clean(filepath.Join(guessResolveBase(configPath), importedDataDir))
}

func guessResolveBase(configPath string) string {
	dir := filepath.Dir(filepath.Clean(configPath))
	if filepath.Base(dir) == "config" {
		return filepath.Dir(dir)
	}
	return dir
}

func compareImportedTarget(currentCfg *configModel.AppConfig, configPath string, importedYAML []byte) []string {
	importedCfg, err := configSvc.ParseConfigBytes(importedYAML)
	if err != nil {
		return []string{"导入后需要重启应用以重新加载配置"}
	}
	warnings := []string{"导入完成后建议立即重启应用，确保配置、安全状态和运行时全部刷新"}
	currentDataDir := effectiveDataDir(configPath, currentCfg.App.DataDir)
	currentDB := buildDBConfig(currentCfg, currentDataDir)
	importedDataDir := resolveImportedDataDir(configPath, importedCfg.App.DataDir)
	importedDB := buildDBConfig(importedCfg, importedDataDir)
	if !sameDatabaseConfig(currentDB, importedDB) {
		warnings = append(warnings, "备份包中的数据库定位与当前运行实例不同，重启前当前会话仍基于现有连接")
	}
	currentSaltPath := filepath.Join(currentDataDir, currentCfg.Security.SaltFile)
	importedSaltPath := filepath.Join(importedDataDir, importedCfg.Security.SaltFile)
	if currentDataDir != importedDataDir || currentSaltPath != importedSaltPath {
		warnings = append(warnings, "备份包中的数据目录或安全文件路径发生变化，重启后才会完全切换到导入配置")
	}
	return warnings
}

func effectiveDataDir(configPath string, configured string) string {
	if filepath.IsAbs(configured) {
		return filepath.Clean(configured)
	}
	return resolveImportedDataDir(configPath, configured)
}

func buildDBConfig(cfg *configModel.AppConfig, dataDir string) database.Config {
	return database.Config{
		Driver:       cfg.Database.Driver,
		FilePath:     filepath.Join(dataDir, cfg.Database.SQLite.Filename),
		Host:         cfg.Database.MySQL.Host,
		Port:         cfg.Database.MySQL.Port,
		Username:     cfg.Database.MySQL.Username,
		Password:     cfg.Database.MySQL.Password,
		DBName:       cfg.Database.MySQL.DBName,
		Params:       cfg.Database.MySQL.Params,
		MaxIdleConns: cfg.Database.Pool.MaxIdleConns,
		MaxOpenConns: cfg.Database.Pool.MaxOpenConns,
	}
}

func sameDatabaseConfig(a, b database.Config) bool {
	return a.Driver == b.Driver &&
		a.FilePath == b.FilePath &&
		a.Host == b.Host &&
		a.Port == b.Port &&
		a.Username == b.Username &&
		a.Password == b.Password &&
		a.DBName == b.DBName &&
		a.Params == b.Params
}

func (s *BackupService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}
