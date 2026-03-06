package service

import (
	"fmt"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
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
	repo    *repository.AssetRepo
	envRepo *repository.EnvironmentRepo
	log     *zap.Logger
}

func NewAssetService(repo *repository.AssetRepo, envRepo *repository.EnvironmentRepo) *AssetService {
	return &AssetService{
		repo:    repo,
		envRepo: envRepo,
		log:     logger.Named("asset"),
	}
}

func (s *AssetService) Create(req CreateAssetRequest) (*model.Asset, error) {
	if _, err := s.envRepo.FindByID(req.EnvironmentID); err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", req.EnvironmentID)
	}

	if _, err := plugin.Get(req.PluginType); err != nil {
		return nil, fmt.Errorf("插件类型无效: %w", err)
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
	return a, nil
}

func (s *AssetService) Update(req UpdateAssetRequest) (*model.Asset, error) {
	a, err := s.repo.FindByID(req.ID)
	if err != nil {
		return nil, fmt.Errorf("资产不存在 [id=%d]", req.ID)
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
	return a, nil
}

func (s *AssetService) Delete(id uint) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return fmt.Errorf("资产不存在 [id=%d]", id)
	}
	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除资产失败: %w", err)
	}
	s.log.Info("删除资产", zap.Uint("id", id))
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
