package service

import (
	"errors"
	"fmt"
	"strings"
	"unicode"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	auditSvc "EnvPilot/internal/audit/service"
	dnsModel "EnvPilot/internal/dns/model"
	dnsSvc "EnvPilot/internal/dns/service"
	"EnvPilot/internal/plugin"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type AssetDNSConfig struct {
	Enabled bool   `json:"enabled"`
	Domain  string `json:"domain"`
	TTL     int    `json:"ttl"`
}

type CreateAssetRequest struct {
	EnvironmentID uint                 `json:"environment_id"`
	GroupID       *uint                `json:"group_id"`
	Category      plugin.AssetCategory `json:"category"`
	PluginType    string               `json:"plugin_type"`
	Name          string               `json:"name"`
	Description   string               `json:"description"`
	Tags          model.Tags           `json:"tags"`
	CredentialID  *uint                `json:"credential_id"`
	ExtConfig     model.ExtConfig      `json:"ext_config"`
	DNSConfig     *AssetDNSConfig      `json:"dns_config,omitempty"`
}

type UpdateAssetRequest struct {
	ID            uint            `json:"id"`
	EnvironmentID uint            `json:"environment_id"`
	GroupID       *uint           `json:"group_id"`
	Name          string          `json:"name"`
	Description   string          `json:"description"`
	Tags          model.Tags      `json:"tags"`
	CredentialID  *uint           `json:"credential_id"`
	ExtConfig     model.ExtConfig `json:"ext_config"`
	DNSConfig     *AssetDNSConfig `json:"dns_config,omitempty"`
}

type AssetConnectionInvalidator interface {
	InvalidateAssetConnections(assetID uint)
}

type AssetService struct {
	repo            *repository.AssetRepo
	envRepo         *repository.EnvironmentRepo
	credRepo        *repository.CredentialRepo
	dnsSvc          *dnsSvc.DNSService
	connInvalidator AssetConnectionInvalidator
	audit           *auditSvc.AuditService
	log             *zap.Logger
}

func NewAssetService(repo *repository.AssetRepo, envRepo *repository.EnvironmentRepo, credRepo *repository.CredentialRepo, dnsSvc *dnsSvc.DNSService, audit *auditSvc.AuditService) *AssetService {
	return &AssetService{
		repo:     repo,
		envRepo:  envRepo,
		credRepo: credRepo,
		dnsSvc:   dnsSvc,
		audit:    audit,
		log:      logger.Named("asset"),
	}
}

func (s *AssetService) SetConnectionInvalidator(invalidator AssetConnectionInvalidator) {
	s.connInvalidator = invalidator
}

func (s *AssetService) Create(req CreateAssetRequest) (*model.Asset, error) {
	env, err := s.envRepo.FindByID(req.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", req.EnvironmentID)
	}

	pluginDef, err := plugin.Get(req.PluginType)
	if err != nil {
		return nil, fmt.Errorf("插件类型无效: %w", err)
	}
	if pluginDef.Category != req.Category {
		return nil, fmt.Errorf("资产类别与插件定义不匹配")
	}
	if err := s.validateCredentialBinding(pluginDef, req.CredentialID); err != nil {
		return nil, err
	}

	if req.ExtConfig == nil {
		req.ExtConfig = make(model.ExtConfig)
	}
	if err := s.validateAutoDNSConfig(pluginDef, req.ExtConfig, req.DNSConfig); err != nil {
		return nil, err
	}

	a := &model.Asset{
		EnvironmentID: req.EnvironmentID,
		GroupID:       req.GroupID,
		Category:      req.Category,
		PluginType:    req.PluginType,
		Name:          req.Name,
		Description:   req.Description,
		Tags:          req.Tags,
		CredentialID:  req.CredentialID,
		Status:        model.AssetStatusUnknown,
		ExtConfig:     req.ExtConfig,
	}

	if err := s.repo.Create(a); err != nil {
		return nil, fmt.Errorf("创建资产失败: %w", err)
	}
	if err := s.createLinkedDNSRecord(a, env.Name, req.DNSConfig); err != nil {
		cleanupErr := s.repo.Delete(a.ID)
		if cleanupErr != nil {
			return nil, fmt.Errorf("自动创建 DNS 失败且回滚资产失败: %v；原始错误: %w", cleanupErr, err)
		}
		return nil, err
	}

	s.log.Info("创建资产",
		zap.String("name", req.Name),
		zap.String("plugin_type", req.PluginType),
		zap.String("category", string(req.Category)),
	)
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "create_asset",
		ResourceType: "asset",
		ResourceID:   &a.ID,
		ResourceName: a.Name,
		PluginType:   a.PluginType,
		Success:      true,
		Detail:       "创建资产",
		Request: map[string]any{
			"category":      a.Category,
			"credential_id": a.CredentialID,
		},
	})
	return a, nil
}

func (s *AssetService) Update(req UpdateAssetRequest) (*model.Asset, error) {
	a, err := s.repo.FindByID(req.ID)
	if err != nil {
		return nil, fmt.Errorf("资产不存在 [id=%d]", req.ID)
	}
	targetEnvID := a.EnvironmentID
	if req.EnvironmentID > 0 {
		targetEnvID = req.EnvironmentID
	}
	env, err := s.envRepo.FindByID(targetEnvID)
	if err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", targetEnvID)
	}

	pluginDef, err := plugin.Get(a.PluginType)
	if err != nil {
		return nil, fmt.Errorf("插件类型无效: %w", err)
	}
	if err := s.validateCredentialBinding(pluginDef, req.CredentialID); err != nil {
		return nil, err
	}

	if req.ExtConfig == nil {
		req.ExtConfig = make(model.ExtConfig)
	}
	if err := s.validateAutoDNSConfig(pluginDef, req.ExtConfig, req.DNSConfig); err != nil {
		return nil, err
	}

	a.EnvironmentID = targetEnvID
	a.GroupID = req.GroupID
	a.Name = req.Name
	a.Description = req.Description
	a.Tags = req.Tags
	a.CredentialID = req.CredentialID
	a.ExtConfig = req.ExtConfig

	if err := s.repo.Update(a); err != nil {
		return nil, fmt.Errorf("更新资产失败: %w", err)
	}
	s.invalidateConnections(a.ID)
	if err := s.syncLinkedDNSRecord(a, env.Name, req.DNSConfig); err != nil {
		return nil, err
	}
	updated, err := s.repo.FindByID(a.ID)
	if err != nil {
		return nil, fmt.Errorf("重新加载资产失败: %w", err)
	}

	s.log.Info("更新资产", zap.Uint("id", req.ID))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "update_asset",
		ResourceType: "asset",
		ResourceID:   &updated.ID,
		ResourceName: updated.Name,
		PluginType:   updated.PluginType,
		Success:      true,
		Detail:       "更新资产",
		Request: map[string]any{
			"credential_id": updated.CredentialID,
			"tag_count":     len(updated.Tags),
		},
	})
	return updated, nil
}

func (s *AssetService) Delete(id uint) error {
	a, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("资产不存在 [id=%d]", id)
	}
	if s.dnsSvc != nil {
		if err := s.dnsSvc.DeleteByAssetID(id); err != nil {
			return fmt.Errorf("删除资产关联 DNS 记录失败: %w", err)
		}
	}
	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除资产失败: %w", err)
	}
	s.log.Info("删除资产", zap.Uint("id", id))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "delete_asset",
		ResourceType: "asset",
		ResourceID:   &a.ID,
		ResourceName: a.Name,
		PluginType:   a.PluginType,
		Success:      true,
		Detail:       "删除资产",
	})
	return nil
}

func (s *AssetService) GetByID(id uint) (*model.Asset, error) {
	return s.repo.FindByID(id)
}

func (s *AssetService) List(f repository.AssetFilter) ([]model.Asset, error) {
	return s.repo.List(f)
}

func (s *AssetService) UpdateStatus(id uint, status model.AssetStatus) error {
	return s.repo.UpdateStatus(id, status)
}

// ListPlugins 列出已注册插件，category 为空时返回全部
func (s *AssetService) ListPlugins(category plugin.AssetCategory) []*plugin.PluginDef {
	return plugin.List(category)
}

// GetPluginSchema 获取指定插件的完整定义（含 ConfigSchema）
func (s *AssetService) GetPluginSchema(pluginType string) (*plugin.PluginDef, error) {
	return plugin.Get(pluginType)
}

func (s *AssetService) validateCredentialBinding(def *plugin.PluginDef, credentialID *uint) error {
	if def == nil {
		return fmt.Errorf("插件定义不存在")
	}
	if credentialID == nil {
		if def.CredentialRequired {
			return fmt.Errorf("当前插件要求绑定凭据")
		}
		return nil
	}
	if s.credRepo == nil {
		return fmt.Errorf("凭据仓库未初始化")
	}
	cred, err := s.credRepo.FindByID(*credentialID)
	if err != nil {
		return fmt.Errorf("凭据不存在 [id=%d]", *credentialID)
	}
	if !def.SupportsCredentialType(string(cred.Type)) {
		return fmt.Errorf("插件 [%s] 不支持凭据类型 [%s]", def.TypeID, cred.Type)
	}
	return nil
}

func (s *AssetService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}

func (s *AssetService) invalidateConnections(assetID uint) {
	if s.connInvalidator == nil {
		return
	}
	s.connInvalidator.InvalidateAssetConnections(assetID)
}

func (s *AssetService) validateAutoDNSConfig(def *plugin.PluginDef, extConfig model.ExtConfig, dnsConfig *AssetDNSConfig) error {
	if dnsConfig == nil || !dnsConfig.Enabled {
		return nil
	}
	if !pluginHasHostField(def) {
		return fmt.Errorf("当前资产类型不支持自动创建 DNS 记录")
	}
	if strings.TrimSpace(extConfig.GetString("host")) == "" {
		return fmt.Errorf("当前资产未配置 host，无法自动创建 DNS 记录")
	}
	if dnsConfig.TTL > 0 && (dnsConfig.TTL < 30 || dnsConfig.TTL > 86400) {
		return fmt.Errorf("DNS TTL 必须在 30 到 86400 秒之间")
	}
	return nil
}

func (s *AssetService) createLinkedDNSRecord(asset *model.Asset, envName string, dnsConfig *AssetDNSConfig) error {
	if s.dnsSvc == nil || dnsConfig == nil || !dnsConfig.Enabled {
		return nil
	}
	domain := strings.TrimSpace(dnsConfig.Domain)
	if domain == "" {
		domain = recommendAssetDomain(asset.Name, asset.PluginType, envName)
	}
	_, err := s.dnsSvc.Create(dnsSvc.CreateDNSRecordRequest{
		EnvironmentID: asset.EnvironmentID,
		AssetID:       &asset.ID,
		Domain:        domain,
		RecordType:    dnsModel.RecordTypeA,
		TTL:           normalizeAssetDNSTTL(dnsConfig.TTL),
		Enabled:       true,
	})
	if err != nil {
		return fmt.Errorf("自动创建 DNS 记录失败: %w", err)
	}
	return nil
}

func (s *AssetService) syncLinkedDNSRecord(asset *model.Asset, envName string, dnsConfig *AssetDNSConfig) error {
	if s.dnsSvc == nil || dnsConfig == nil {
		return nil
	}
	record, err := s.dnsSvc.GetByAssetID(asset.ID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return fmt.Errorf("查询资产关联 DNS 记录失败: %w", err)
	}
	if err != nil {
		record = nil
	}
	if !dnsConfig.Enabled {
		if record != nil {
			if err := s.dnsSvc.Delete(record.ID); err != nil {
				return fmt.Errorf("删除资产关联 DNS 记录失败: %w", err)
			}
		}
		return nil
	}
	domain := strings.TrimSpace(dnsConfig.Domain)
	if domain == "" {
		domain = recommendAssetDomain(asset.Name, asset.PluginType, envName)
	}
	ttl := normalizeAssetDNSTTL(dnsConfig.TTL)
	if record == nil {
		return s.createLinkedDNSRecord(asset, envName, &AssetDNSConfig{
			Enabled: true,
			Domain:  domain,
			TTL:     ttl,
		})
	}
	_, err = s.dnsSvc.Update(dnsSvc.UpdateDNSRecordRequest{
		ID:            record.ID,
		EnvironmentID: asset.EnvironmentID,
		AssetID:       &asset.ID,
		Domain:        domain,
		RecordType:    dnsModel.RecordTypeA,
		TTL:           ttl,
		Enabled:       true,
	})
	if err != nil {
		return fmt.Errorf("更新资产关联 DNS 记录失败: %w", err)
	}
	return nil
}

func normalizeAssetDNSTTL(ttl int) int {
	if ttl <= 0 {
		return 300
	}
	return ttl
}

func pluginHasHostField(def *plugin.PluginDef) bool {
	if def == nil {
		return false
	}
	for _, field := range def.ConfigSchema {
		if field.Key == "host" {
			return true
		}
	}
	return false
}

func recommendAssetDomain(assetName, pluginType, envName string) string {
	assetPart := slugDomainLabel(assetName)
	pluginPart := slugDomainLabel(pluginType)
	envPart := slugDomainLabel(envName)
	if assetPart == "" {
		assetPart = "asset"
	}
	if pluginPart == "" {
		pluginPart = "service"
	}
	if envPart == "" {
		envPart = "env"
	}
	return fmt.Sprintf("%s.%s.%s.local", assetPart, pluginPart, envPart)
}

func slugDomainLabel(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	if input == "" {
		return ""
	}
	var builder strings.Builder
	lastHyphen := false
	for _, r := range input {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			builder.WriteRune(r)
			lastHyphen = false
		case r == '-' || r == '_' || unicode.IsSpace(r) || r == '.':
			if builder.Len() > 0 && !lastHyphen {
				builder.WriteRune('-')
				lastHyphen = true
			}
		}
	}
	return strings.Trim(builder.String(), "-")
}
