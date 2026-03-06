package service

import (
	"fmt"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

// GroupService 分组业务逻辑服务
type GroupService struct {
	repo    *repository.GroupRepo
	envRepo *repository.EnvironmentRepo
	log     *zap.Logger
}

func NewGroupService(repo *repository.GroupRepo, envRepo *repository.EnvironmentRepo) *GroupService {
	return &GroupService{
		repo:    repo,
		envRepo: envRepo,
		log:     logger.Named("group"),
	}
}

// Create 创建分组，校验环境是否存在
func (s *GroupService) Create(envID uint, name, description string) (*model.Group, error) {
	if _, err := s.envRepo.FindByID(envID); err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", envID)
	}

	g := &model.Group{
		EnvironmentID: envID,
		Name:          name,
		Description:   description,
	}

	if err := s.repo.Create(g); err != nil {
		return nil, fmt.Errorf("创建分组失败: %w", err)
	}

	s.log.Info("创建分组", zap.String("name", name), zap.Uint("env_id", envID))
	return g, nil
}

// Update 更新分组信息
func (s *GroupService) Update(id uint, name, description string) (*model.Group, error) {
	g, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("分组不存在 [id=%d]", id)
	}

	g.Name = name
	g.Description = description

	if err := s.repo.Update(g); err != nil {
		return nil, fmt.Errorf("更新分组失败: %w", err)
	}

	s.log.Info("更新分组", zap.Uint("id", id), zap.String("name", name))
	return g, nil
}

// Delete 删除分组
func (s *GroupService) Delete(id uint) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return fmt.Errorf("分组不存在 [id=%d]", id)
	}

	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除分组失败: %w", err)
	}

	s.log.Info("删除分组", zap.Uint("id", id))
	return nil
}

// ListByEnvironment 获取某环境下所有分组
func (s *GroupService) ListByEnvironment(envID uint) ([]model.Group, error) {
	return s.repo.ListByEnvironment(envID)
}

// ListAll 获取所有分组
func (s *GroupService) ListAll() ([]model.Group, error) {
	return s.repo.ListAll()
}
