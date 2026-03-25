package service

import (
	"errors"
	"fmt"
	"strings"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	auditSvc "EnvPilot/internal/audit/service"
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
	repo            *repository.CredentialRepo
	assets          *repository.AssetRepo
	connInvalidator AssetConnectionInvalidator
	cipher          *crypto.AESCipher
	audit           *auditSvc.AuditService
	log             *zap.Logger
}

type CredentialBoundError struct {
	CredentialID uint
	AssetNames   []string
}

func (e *CredentialBoundError) Error() string {
	if e == nil {
		return "凭据已被资产绑定，无法删除"
	}
	if len(e.AssetNames) == 0 {
		return fmt.Sprintf("凭据 [id=%d] 已被资产绑定，无法删除", e.CredentialID)
	}
	return fmt.Sprintf("当前凭据已绑定以下资产，无法删除：%s", strings.Join(e.AssetNames, "；"))
}

func NewCredentialService(repo *repository.CredentialRepo, assetRepo *repository.AssetRepo, cipher *crypto.AESCipher, audit *auditSvc.AuditService) *CredentialService {
	return &CredentialService{
		repo:   repo,
		assets: assetRepo,
		cipher: cipher,
		audit:  audit,
		log:    logger.Named("credential"),
	}
}

func (s *CredentialService) SetConnectionInvalidator(invalidator AssetConnectionInvalidator) {
	s.connInvalidator = invalidator
}

// Create 创建凭据，Secret 加密后入库
func (s *CredentialService) Create(name string, credType model.CredentialType, username, secret string) (*model.Credential, error) {
	if err := validateCredentialInput(credType, username, secret, false); err != nil {
		return nil, err
	}

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
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "create_credential",
		ResourceType: "credential",
		ResourceID:   &c.ID,
		ResourceName: c.Name,
		Success:      true,
		Detail:       "创建凭据",
		Request: map[string]any{
			"type":     credType,
			"username": username,
		},
	})
	// 返回前脱敏
	return s.mask(c), nil
}

// Update 更新凭据（若 secret 不为空则重新加密）
func (s *CredentialService) Update(id uint, name string, credType model.CredentialType, username, secret string) (*model.Credential, error) {
	if err := validateCredentialInput(credType, username, secret, true); err != nil {
		return nil, err
	}

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
	s.invalidateBoundAssetConnections(id)

	s.log.Info("更新凭据", zap.Uint("id", id))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "update_credential",
		ResourceType: "credential",
		ResourceID:   &c.ID,
		ResourceName: c.Name,
		Success:      true,
		Detail:       "更新凭据",
		Request: map[string]any{
			"type":     credType,
			"username": username,
			"rotate":   secret != "",
		},
	})
	return s.mask(c), nil
}

// Delete 删除凭据
func (s *CredentialService) Delete(id uint) error {
	c, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("凭据不存在 [id=%d]", id)
	}
	assetNames, err := s.GetBoundAssetNames(id)
	if err != nil {
		return err
	}
	if len(assetNames) > 0 {
		return &CredentialBoundError{CredentialID: id, AssetNames: assetNames}
	}
	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除凭据失败: %w", err)
	}
	s.log.Info("删除凭据", zap.Uint("id", id))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "delete_credential",
		ResourceType: "credential",
		ResourceID:   &c.ID,
		ResourceName: c.Name,
		Success:      true,
		Detail:       "删除凭据",
	})
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

func (s *CredentialService) GetBoundAssetNames(id uint) ([]string, error) {
	if s.assets == nil {
		return nil, nil
	}
	boundAssets, err := s.assets.ListByCredentialID(id)
	if err != nil {
		return nil, fmt.Errorf("查询凭据绑定资产失败: %w", err)
	}
	assetNames := make([]string, 0, len(boundAssets))
	for _, asset := range boundAssets {
		parts := make([]string, 0, 3)
		if strings.TrimSpace(asset.Environment.Name) != "" {
			parts = append(parts, asset.Environment.Name)
		}
		if asset.Group != nil && strings.TrimSpace(asset.Group.Name) != "" {
			parts = append(parts, asset.Group.Name)
		}
		parts = append(parts, asset.Name)
		assetNames = append(assetNames, strings.Join(parts, " / "))
	}
	return assetNames, nil
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
	s.recordAudit(auditSvc.RecordInput{
		Module:       "asset",
		Action:       "reveal_credential",
		ResourceType: "credential",
		ResourceID:   &c.ID,
		ResourceName: c.Name,
		Success:      true,
		Detail:       "查看凭据明文",
		Request:      map[string]any{"type": c.Type},
	})
	return plain, nil
}

// mask 对凭据 secret 字段脱敏（不修改原始结构体）
func (s *CredentialService) mask(c *model.Credential) *model.Credential {
	result := *c
	result.Secret = ""
	result.SecretMasked = "****"
	return &result
}

func validateCredentialInput(credType model.CredentialType, username, secret string, allowEmptySecret bool) error {
	if !model.IsValidCredentialType(credType) {
		return fmt.Errorf("不支持的凭据类型: %s", credType)
	}
	if !allowEmptySecret && secret == "" {
		return fmt.Errorf("凭据密钥不能为空")
	}
	switch credType {
	case model.CredentialTypePassword, model.CredentialTypeAccessKeyPair, model.CredentialTypeSASL:
		if username == "" {
			return fmt.Errorf("当前凭据类型要求填写用户名或标识")
		}
	}
	return nil
}

func (s *CredentialService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}

func (s *CredentialService) invalidateBoundAssetConnections(credentialID uint) {
	if s.connInvalidator == nil || s.assets == nil {
		return
	}
	assets, err := s.assets.ListByCredentialID(credentialID)
	if err != nil {
		s.log.Warn("查询凭据绑定资产失败，跳过连接池失效", zap.Uint("credential_id", credentialID), zap.Error(err))
		return
	}
	for _, asset := range assets {
		s.connInvalidator.InvalidateAssetConnections(asset.ID)
	}
}

func IsCredentialBoundError(err error) bool {
	var target *CredentialBoundError
	return errors.As(err, &target)
}
