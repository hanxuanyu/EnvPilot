package service

import (
	"fmt"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

// CreateAssetRequest 创建资产请求参数
type CreateAssetRequest struct {
	EnvironmentID uint
	GroupID       *uint
	Type          model.AssetType
	Name          string
	Host          string
	Port          int
	Description   string
	Tags          model.Tags
	CredentialID  *uint
}

// UpdateAssetRequest 更新资产请求参数
type UpdateAssetRequest struct {
	ID            uint
	GroupID       *uint
	Name          string
	Host          string
	Port          int
	Description   string
	Tags          model.Tags
	CredentialID  *uint
}

// AssetService 资产业务逻辑服务
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

// Create 创建资产，自动补全默认端口
func (s *AssetService) Create(req CreateAssetRequest) (*model.Asset, error) {
	if _, err := s.envRepo.FindByID(req.EnvironmentID); err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", req.EnvironmentID)
	}

	// 未指定端口时使用类型默认端口
	port := req.Port
	if port <= 0 {
		port = model.DefaultPort(req.Type)
	}

	a := &model.Asset{
		EnvironmentID: req.EnvironmentID,
		GroupID:       req.GroupID,
		Type:          req.Type,
		Name:          req.Name,
		Host:          req.Host,
		Port:          port,
		Description:   req.Description,
		Tags:          req.Tags,
		CredentialID:  req.CredentialID,
		Status:        model.AssetStatusUnknown,
	}

	if err := s.repo.Create(a); err != nil {
		return nil, fmt.Errorf("创建资产失败: %w", err)
	}

	s.log.Info("创建资产",
		zap.String("name", req.Name),
		zap.String("type", string(req.Type)),
		zap.String("host", req.Host),
	)
	return a, nil
}

// Update 更新资产信息
func (s *AssetService) Update(req UpdateAssetRequest) (*model.Asset, error) {
	a, err := s.repo.FindByID(req.ID)
	if err != nil {
		return nil, fmt.Errorf("资产不存在 [id=%d]", req.ID)
	}

	a.GroupID = req.GroupID
	a.Name = req.Name
	a.Host = req.Host
	a.Port = req.Port
	a.Description = req.Description
	a.Tags = req.Tags
	a.CredentialID = req.CredentialID

	if err := s.repo.Update(a); err != nil {
		return nil, fmt.Errorf("更新资产失败: %w", err)
	}

	s.log.Info("更新资产", zap.Uint("id", req.ID))
	return a, nil
}

// Delete 删除资产
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

// GetByID 获取单个资产详情
func (s *AssetService) GetByID(id uint) (*model.Asset, error) {
	return s.repo.FindByID(id)
}

// List 查询资产列表（支持筛选和搜索）
func (s *AssetService) List(q repository.AssetQuery) ([]model.Asset, error) {
	return s.repo.List(q)
}

// UpdateStatus 更新资产在线状态（供健康检查模块调用）
func (s *AssetService) UpdateStatus(id uint, status model.AssetStatus) error {
	return s.repo.UpdateStatus(id, status)
}
