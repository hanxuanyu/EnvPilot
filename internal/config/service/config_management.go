package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"time"

	auditSvc "EnvPilot/internal/audit/service"
	configModel "EnvPilot/internal/config/model"
	configRepo "EnvPilot/internal/config/repository"

	"gopkg.in/yaml.v3"
	"gorm.io/gorm"
)

type CurrentConfigResult struct {
	Config          configModel.AppConfig          `json:"config"`
	YAML            string                         `json:"yaml"`
	ConfigPath      string                         `json:"config_path"`
	RequiresRestart bool                           `json:"requires_restart"`
	HotReload       HotReloadResult                `json:"hot_reload"`
	LatestSnapshot  *configModel.ConfigSnapshot    `json:"latest_snapshot,omitempty"`
}

type UpdateRawConfigRequest struct {
	Config   map[string]any `json:"config"`
	Comment  string         `json:"comment"`
	Operator string         `json:"operator"`
}

type ListSnapshotsRequest struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
}

type ListSnapshotsResult struct {
	Items []configModel.ConfigSnapshot `json:"items"`
	Total int64                        `json:"total"`
}

type SnapshotDetailResult struct {
	Snapshot configModel.ConfigSnapshot `json:"snapshot"`
}

type RollbackConfigRequest struct {
	SnapshotID uint   `json:"snapshot_id"`
	Comment    string `json:"comment"`
	Operator   string `json:"operator"`
}

func (s *ConfigService) AttachSnapshotStore(repo *configRepo.ConfigSnapshotRepo, audit *auditSvc.AuditService) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snapshotRepo = repo
	s.audit = audit
}

func (s *ConfigService) EnsureInitialSnapshot() error {
	if s.snapshotRepo == nil {
		return nil
	}
	count, err := s.snapshotRepo.Count()
	if err != nil {
		return fmt.Errorf("检查配置快照失败: %w", err)
	}
	if count > 0 {
		return nil
	}
	content, err := s.readRawConfigFile()
	if err != nil {
		return err
	}
	_, err = s.createSnapshot(content, "系统初始化导入", "system")
	if err != nil {
		return fmt.Errorf("创建初始配置快照失败: %w", err)
	}
	return nil
}

func (s *ConfigService) GetCurrent() (*CurrentConfigResult, error) {
	content, err := s.readRawConfigFile()
	if err != nil {
		return nil, err
	}
	cfg, err := parseConfigBytes(content)
	if err != nil {
		return nil, err
	}
	var latest *configModel.ConfigSnapshot
	if s.snapshotRepo != nil {
		latest, _ = s.snapshotRepo.GetLatest()
	}
	hotReload := s.getLastHotReload()
	return &CurrentConfigResult{
		Config:          *cfg,
		YAML:            string(content),
		ConfigPath:      s.configPath,
		RequiresRestart: len(hotReload.RestartRequired) > 0,
		HotReload:       hotReload,
		LatestSnapshot:  latest,
	}, nil
}

func (s *ConfigService) UpdateRaw(req UpdateRawConfigRequest) (*CurrentConfigResult, error) {
	current, err := s.GetCurrent()
	if err != nil {
		return nil, err
	}

	var nextConfig configModel.AppConfig
	buf, err := json.Marshal(req.Config)
	if err != nil {
		return nil, fmt.Errorf("配置序列化失败: %w", err)
	}
	if err := json.Unmarshal(buf, &nextConfig); err != nil {
		return nil, fmt.Errorf("配置格式错误: %w", err)
	}
	applyDefaults(&nextConfig)
	if err := validate(&nextConfig); err != nil {
		return nil, fmt.Errorf("配置校验失败: %w", err)
	}

	content, err := marshalConfigYAML(&nextConfig)
	if err != nil {
		return nil, err
	}
	if normalizedYAML(current.YAML) == normalizedYAML(content) {
		return current, nil
	}

	if err := s.writeRawConfigFile([]byte(content)); err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "config",
			Action:       "update_config",
			ResourceType: "config",
			Operator:     normalizeOperator(req.Operator),
			Success:      false,
			Detail:       err.Error(),
			Request: map[string]any{
				"comment": req.Comment,
			},
		})
		return nil, err
	}
	if err := s.Load(); err != nil {
		return nil, fmt.Errorf("重新加载配置失败: %w", err)
	}
	hotReload := s.applyRuntimeConfig(&current.Config, s.Get())
	latest, err := s.createSnapshot([]byte(content), req.Comment, normalizeOperator(req.Operator))
	if err != nil {
		return nil, err
	}
	s.recordAudit(auditSvc.RecordInput{
		Module:       "config",
		Action:       "update_config",
		ResourceType: "config",
		Operator:     normalizeOperator(req.Operator),
		Success:      true,
		Detail:       detailOrDefault(req.Comment, "配置已更新并生成新快照"),
		Request: map[string]any{
			"comment": req.Comment,
		},
		Result: map[string]any{
			"snapshot_version": latest.Version,
			"hot_reload":       hotReload,
		},
	})
	result, err := s.GetCurrent()
	if err != nil {
		return nil, err
	}
	result.LatestSnapshot = latest
	return result, nil
}

func (s *ConfigService) ListSnapshots(req ListSnapshotsRequest) (*ListSnapshotsResult, error) {
	if s.snapshotRepo == nil {
		return &ListSnapshotsResult{Items: []configModel.ConfigSnapshot{}, Total: 0}, nil
	}
	items, total, err := s.snapshotRepo.List(configRepo.SnapshotFilter(req))
	if err != nil {
		return nil, fmt.Errorf("查询配置快照失败: %w", err)
	}
	return &ListSnapshotsResult{Items: items, Total: total}, nil
}

func (s *ConfigService) GetSnapshot(id uint) (*SnapshotDetailResult, error) {
	if s.snapshotRepo == nil {
		return nil, fmt.Errorf("配置快照仓库未初始化")
	}
	snapshot, err := s.snapshotRepo.GetByID(id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("配置快照不存在 [id=%d]", id)
		}
		return nil, fmt.Errorf("读取配置快照失败: %w", err)
	}
	return &SnapshotDetailResult{Snapshot: *snapshot}, nil
}

func (s *ConfigService) Rollback(req RollbackConfigRequest) (*CurrentConfigResult, error) {
	if s.snapshotRepo == nil {
		return nil, fmt.Errorf("配置快照仓库未初始化")
	}
	current, err := s.GetCurrent()
	if err != nil {
		return nil, err
	}
	snapshot, err := s.snapshotRepo.GetByID(req.SnapshotID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("配置快照不存在 [id=%d]", req.SnapshotID)
		}
		return nil, fmt.Errorf("读取配置快照失败: %w", err)
	}
	if _, err := parseConfigBytes([]byte(snapshot.Content)); err != nil {
		return nil, fmt.Errorf("目标快照内容无效，无法回滚: %w", err)
	}
	if err := s.writeRawConfigFile([]byte(snapshot.Content)); err != nil {
		return nil, err
	}
	if err := s.Load(); err != nil {
		return nil, fmt.Errorf("重新加载配置失败: %w", err)
	}
	hotReload := s.applyRuntimeConfig(&current.Config, s.Get())
	latest, err := s.createSnapshot([]byte(snapshot.Content), rollbackComment(snapshot.Version, req.Comment), normalizeOperator(req.Operator))
	if err != nil {
		return nil, err
	}
	s.recordAudit(auditSvc.RecordInput{
		Module:       "config",
		Action:       "rollback_config",
		ResourceType: "config",
		Operator:     normalizeOperator(req.Operator),
		Success:      true,
		Detail:       fmt.Sprintf("配置已回滚到 v%d", snapshot.Version),
		Request: map[string]any{
			"snapshot_id": req.SnapshotID,
			"comment":     req.Comment,
		},
		Result: map[string]any{
			"snapshot_version": latest.Version,
			"rolled_back_to":   snapshot.Version,
			"hot_reload":       hotReload,
		},
	})
	result, err := s.GetCurrent()
	if err != nil {
		return nil, err
	}
	result.LatestSnapshot = latest
	return result, nil
}

func parseConfigBytes(data []byte) (*configModel.AppConfig, error) {
	var cfg configModel.AppConfig
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("解析 YAML 失败: %w", err)
	}
	applyDefaults(&cfg)
	if err := validate(&cfg); err != nil {
		return nil, fmt.Errorf("配置校验失败: %w", err)
	}
	return &cfg, nil
}

func marshalConfigYAML(cfg *configModel.AppConfig) (string, error) {
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return "", fmt.Errorf("序列化配置失败: %w", err)
	}
	var buf bytes.Buffer
	buf.WriteString("# EnvPilot 系统配置文件（通过配置管理页面更新）\n")
	buf.Write(data)
	return buf.String(), nil
}

func normalizedYAML(content string) string {
	return strings.TrimSpace(strings.ReplaceAll(content, "\r\n", "\n"))
}

func (s *ConfigService) createSnapshot(content []byte, comment string, createdBy string) (*configModel.ConfigSnapshot, error) {
	if s.snapshotRepo == nil {
		return nil, nil
	}
	latest, err := s.snapshotRepo.GetLatest()
	if err == nil && normalizedYAML(latest.Content) == normalizedYAML(string(content)) {
		return latest, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, fmt.Errorf("读取最新配置快照失败: %w", err)
	}
	version, err := s.snapshotRepo.NextVersion()
	if err != nil {
		return nil, fmt.Errorf("生成配置快照版本失败: %w", err)
	}
	snapshot := &configModel.ConfigSnapshot{
		Version:   version,
		Content:   string(content),
		Comment:   strings.TrimSpace(comment),
		CreatedBy: normalizeOperator(createdBy),
		CreatedAt: time.Now(),
	}
	if err := s.snapshotRepo.Create(snapshot); err != nil {
		return nil, fmt.Errorf("写入配置快照失败: %w", err)
	}
	return snapshot, nil
}

func (s *ConfigService) readRawConfigFile() ([]byte, error) {
	absPath, err := filepath.Abs(s.configPath)
	if err != nil {
		return nil, fmt.Errorf("解析配置路径失败: %w", err)
	}
	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("读取配置文件失败 [%s]: %w", absPath, err)
	}
	return data, nil
}

func (s *ConfigService) writeRawConfigFile(data []byte) error {
	absPath, err := filepath.Abs(s.configPath)
	if err != nil {
		return fmt.Errorf("解析配置路径失败: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(absPath), 0o755); err != nil {
		return fmt.Errorf("创建配置目录失败: %w", err)
	}
	tmpPath := absPath + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0o644); err != nil {
		return fmt.Errorf("写入配置临时文件失败: %w", err)
	}
	if err := os.Rename(tmpPath, absPath); err != nil {
		return fmt.Errorf("替换配置文件失败: %w", err)
	}
	return nil
}

func (s *ConfigService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}

func normalizeOperator(operator string) string {
	if strings.TrimSpace(operator) == "" {
		return "admin"
	}
	return strings.TrimSpace(operator)
}

func rollbackComment(version int, comment string) string {
	comment = strings.TrimSpace(comment)
	if comment == "" {
		return fmt.Sprintf("回滚到 v%d", version)
	}
	return fmt.Sprintf("回滚到 v%d：%s", version, comment)
}

func detailOrDefault(detail string, fallback string) string {
	if strings.TrimSpace(detail) == "" {
		return fallback
	}
	return strings.TrimSpace(detail)
}

func (s *ConfigService) applyRuntimeConfig(prev, next *configModel.AppConfig) HotReloadResult {
	if prev == nil || next == nil {
		result := HotReloadResult{}
		s.setLastHotReload(result)
		return result
	}

	result := HotReloadResult{}
	s.mu.RLock()
	applier := s.runtimeApplier
	s.mu.RUnlock()
	if applier == nil {
		s.setLastHotReload(result)
		return result
	}

	applyResult, err := applier.ApplyConfig(prev, next)
	if applyResult != nil {
		result = *applyResult
	}
	if err != nil {
		result.Messages = append(result.Messages, fmt.Sprintf("部分热更新未完成：%v", err))
		if len(result.RestartRequired) == 0 {
			result.RestartRequired = append(result.RestartRequired, "运行时组件热更新失败，请重启应用")
		}
	}
	s.setLastHotReload(result)
	return result
}

func sameConfig(a, b configModel.AppConfig) bool {
	return reflect.DeepEqual(a, b)
}