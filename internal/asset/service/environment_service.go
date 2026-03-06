// Package service 实现资产模块的业务逻辑。
package service

import (
	"fmt"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

// EnvironmentService 环境业务逻辑服务
type EnvironmentService struct {
	repo *repository.EnvironmentRepo
	log  *zap.Logger
}

func NewEnvironmentService(repo *repository.EnvironmentRepo) *EnvironmentService {
	return &EnvironmentService{
		repo: repo,
		log:  logger.Named("environment"),
	}
}

// Create 创建新环境，名称不允许重复
func (s *EnvironmentService) Create(name, description, color string) (*model.Environment, error) {
	exists, err := s.repo.ExistsByName(name, 0)
	if err != nil {
		return nil, fmt.Errorf("检查环境名称失败: %w", err)
	}
	if exists {
		return nil, fmt.Errorf("环境名称 [%s] 已存在", name)
	}

	if color == "" {
		color = "#3b82f6"
	}

	env := &model.Environment{
		Name:        name,
		Description: description,
		Color:       color,
	}

	if err := s.repo.Create(env); err != nil {
		return nil, fmt.Errorf("创建环境失败: %w", err)
	}

	s.log.Info("创建环境", zap.String("name", name), zap.Uint("id", env.ID))
	return env, nil
}

// Update 更新环境信息
func (s *EnvironmentService) Update(id uint, name, description, color string) (*model.Environment, error) {
	env, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", id)
	}

	if name != env.Name {
		exists, err := s.repo.ExistsByName(name, id)
		if err != nil {
			return nil, fmt.Errorf("检查环境名称失败: %w", err)
		}
		if exists {
			return nil, fmt.Errorf("环境名称 [%s] 已存在", name)
		}
	}

	env.Name = name
	env.Description = description
	if color != "" {
		env.Color = color
	}

	if err := s.repo.Update(env); err != nil {
		return nil, fmt.Errorf("更新环境失败: %w", err)
	}

	s.log.Info("更新环境", zap.Uint("id", id), zap.String("name", name))
	return env, nil
}

// Delete 删除环境（检查是否有关联资产）
func (s *EnvironmentService) Delete(id uint) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return fmt.Errorf("环境不存在 [id=%d]", id)
	}

	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除环境失败: %w", err)
	}

	s.log.Info("删除环境", zap.Uint("id", id))
	return nil
}

// GetByID 获取单个环境详情
func (s *EnvironmentService) GetByID(id uint) (*model.Environment, error) {
	return s.repo.FindByID(id)
}

// ListAll 获取所有环境
func (s *EnvironmentService) ListAll() ([]model.Environment, error) {
	return s.repo.ListAll()
}
