package service

import (
	"fmt"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	auditSvc "EnvPilot/internal/audit/service"
	"EnvPilot/internal/plugin"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

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
}

type UpdateAssetRequest struct {
	ID           uint            `json:"id"`
	GroupID      *uint           `json:"group_id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Tags         model.Tags      `json:"tags"`
	CredentialID *uint           `json:"credential_id"`
	ExtConfig    model.ExtConfig `json:"ext_config"`
}

type AssetService struct {
	repo     *repository.AssetRepo
	envRepo  *repository.EnvironmentRepo
	credRepo *repository.CredentialRepo
	audit    *auditSvc.AuditService
	log      *zap.Logger
}

func NewAssetService(repo *repository.AssetRepo, envRepo *repository.EnvironmentRepo, credRepo *repository.CredentialRepo, audit *auditSvc.AuditService) *AssetService {
	return &AssetService{
		repo:     repo,
		envRepo:  envRepo,
		credRepo: credRepo,
		audit:    audit,
		log:      logger.Named("asset"),
	}
}

func (s *AssetService) Create(req CreateAssetRequest) (*model.Asset, error) {
	if _, err := s.envRepo.FindByID(req.EnvironmentID); err != nil {
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

	a.GroupID = req.GroupID
	a.Name = req.Name
	a.Description = req.Description
	a.Tags = req.Tags
	a.CredentialID = req.CredentialID
	a.ExtConfig = req.ExtConfig

	if err := s.repo.Update(a); err != nil {
		return nil, fmt.Errorf("更新资产失败: %w", err)
	}

	s.log.Info("更新资产", zap.Uint("id", req.ID))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "update_asset",
		ResourceType: "asset",
		ResourceID:   &a.ID,
		ResourceName: a.Name,
		PluginType:   a.PluginType,
		Success:      true,
		Detail:       "更新资产",
		Request: map[string]any{
			"credential_id": a.CredentialID,
			"tag_count":     len(a.Tags),
		},
	})
	return a, nil
}

func (s *AssetService) Delete(id uint) error {
	a, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("资产不存在 [id=%d]", id)
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
