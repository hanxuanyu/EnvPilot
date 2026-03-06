package model

import "time"

// CredentialType 凭据类型
type CredentialType string

const (
	CredentialTypePassword CredentialType = "password"  // 用户名+密码
	CredentialTypeSSHKey   CredentialType = "ssh_key"   // SSH 私钥
	CredentialTypeToken    CredentialType = "token"      // API Token / 访问密钥
)

// Credential 访问凭据（密码/SSH私钥/Token）
//
// 安全规范：
//   - Secret 字段存入数据库前必须通过 pkg/crypto 加密
//   - 对外展示时必须脱敏（maskSecret）
//   - 只在 Service 内部真正使用时才解密
type Credential struct {
	ID        uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string         `gorm:"size:100;not null" json:"name"`
	Type      CredentialType `gorm:"size:20;not null" json:"type"`
	Username  string         `gorm:"size:200" json:"username"`
	// Secret 存储 AES-256-GCM 加密后的 base64 字符串，明文永远不落库
	Secret    string         `gorm:"type:text;not null" json:"-"`
	// SecretMasked 脱敏后的展示值，由 service 层填充，不存库
	SecretMasked string `gorm:"-" json:"secret_masked,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}
