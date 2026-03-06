package service

import (
	"fmt"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/pkg/crypto"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

// CredentialService 凭据业务逻辑服务
//
// 安全职责：
//   - 所有凭据写入前加密，读出后脱敏
//   - 只有明确调用 RevealSecret 才解密原文（用于实际连接）
type CredentialService struct {
	repo   *repository.CredentialRepo
	cipher *crypto.AESCipher
	log    *zap.Logger
}

func NewCredentialService(repo *repository.CredentialRepo, cipher *crypto.AESCipher) *CredentialService {
	return &CredentialService{
		repo:   repo,
		cipher: cipher,
		log:    logger.Named("credential"),
	}
}

// Create 创建凭据，Secret 加密后入库
func (s *CredentialService) Create(name string, credType model.CredentialType, username, secret string) (*model.Credential, error) {
	encrypted, err := s.cipher.Encrypt(secret)
	if err != nil {
		return nil, fmt.Errorf("凭据加密失败: %w", err)
	}

	c := &model.Credential{
		Name:     name,
		Type:     credType,
		Username: username,
		Secret:   encrypted,
	}

	if err := s.repo.Create(c); err != nil {
		return nil, fmt.Errorf("创建凭据失败: %w", err)
	}

	s.log.Info("创建凭据", zap.String("name", name), zap.String("type", string(credType)))
	// 返回前脱敏
	return s.mask(c), nil
}

// Update 更新凭据（若 secret 不为空则重新加密）
func (s *CredentialService) Update(id uint, name string, credType model.CredentialType, username, secret string) (*model.Credential, error) {
	c, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("凭据不存在 [id=%d]", id)
	}

	c.Name = name
	c.Type = credType
	c.Username = username

	// 仅当传入新 secret 时才重新加密
	if secret != "" {
		encrypted, err := s.cipher.Encrypt(secret)
		if err != nil {
			return nil, fmt.Errorf("凭据加密失败: %w", err)
		}
		c.Secret = encrypted
	}

	if err := s.repo.Update(c); err != nil {
		return nil, fmt.Errorf("更新凭据失败: %w", err)
	}

	s.log.Info("更新凭据", zap.Uint("id", id))
	return s.mask(c), nil
}

// Delete 删除凭据
func (s *CredentialService) Delete(id uint) error {
	if _, err := s.repo.FindByID(id); err != nil {
		return fmt.Errorf("凭据不存在 [id=%d]", id)
	}
	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除凭据失败: %w", err)
	}
	s.log.Info("删除凭据", zap.Uint("id", id))
	return nil
}

// ListAll 获取所有凭据（脱敏）
func (s *CredentialService) ListAll() ([]model.Credential, error) {
	list, err := s.repo.ListAll()
	if err != nil {
		return nil, err
	}
	masked := make([]model.Credential, len(list))
	for i, c := range list {
		c := c
		masked[i] = *s.mask(&c)
	}
	return masked, nil
}

// RevealSecret 解密并返回凭据原文（仅供 executor/connector 内部使用）
// 注意：此方法不对外暴露 API，只在 Go 内部调用
func (s *CredentialService) RevealSecret(id uint) (string, error) {
	c, err := s.repo.FindByID(id)
	if err != nil {
		return "", fmt.Errorf("凭据不存在 [id=%d]", id)
	}

	plain, err := s.cipher.Decrypt(c.Secret)
	if err != nil {
		return "", fmt.Errorf("凭据解密失败: %w", err)
	}

	s.log.Info("解密凭据", zap.Uint("id", id))
	return plain, nil
}

// mask 对凭据 secret 字段脱敏（不修改原始结构体）
func (s *CredentialService) mask(c *model.Credential) *model.Credential {
	result := *c
	result.Secret = ""
	result.SecretMasked = "****"
	return &result
}
