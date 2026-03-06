// Package crypto 提供 EnvPilot 所有敏感数据的加解密能力。
//
// 设计目的：
//   - 统一管理全部加解密操作，避免各模块自行实现
//   - 使用 AES-256-GCM 模式：同时提供加密和完整性校验
//   - 密文前缀附加随机 nonce，保证相同明文每次加密结果不同
//
// 安全说明：
//   - AES-256-GCM 是经过广泛验证的 AEAD 加密方案
//   - 每次加密使用随机 nonce（12 字节），防止重放攻击
//   - 加密结果格式：[12字节nonce][密文+16字节GCM tag]，整体 base64 编码
//
// 使用方式：
//
//	cipher := crypto.NewAESCipher(key32Bytes)
//	encrypted, err := cipher.Encrypt("my-password")
//	plain, err := cipher.Decrypt(encrypted)
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// AESCipher AES-256-GCM 加解密器
type AESCipher struct {
	// key 必须是 32 字节（AES-256）
	key []byte
}

// NewAESCipher 创建 AES 加密器，key 必须为 32 字节
func NewAESCipher(key []byte) (*AESCipher, error) {
	if len(key) != 32 {
		return nil, errors.New("AES-256 密钥必须为 32 字节")
	}
	// 复制 key，避免外部修改影响内部状态
	k := make([]byte, 32)
	copy(k, key)
	return &AESCipher{key: k}, nil
}

// Encrypt 将明文字符串加密为 base64 编码的密文。
// 每次调用使用随机 nonce，相同明文加密结果不同。
func (c *AESCipher) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}

	// GCM 模式提供认证加密（AEAD）
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 生成随机 nonce（12 字节是 GCM 推荐长度）
	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Seal 将 nonce 和密文拼接：[nonce][密文+tag]
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)

	// base64 编码方便存储到 SQLite
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt 将 base64 密文解密为原始明文字符串
func (c *AESCipher) Decrypt(encoded string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", errors.New("密文 base64 解码失败: " + err.Error())
	}

	block, err := aes.NewCipher(c.key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", errors.New("密文长度不足，数据可能已损坏")
	}

	// 分离 nonce 和实际密文
	nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]

	// Open 解密并验证完整性
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", errors.New("解密失败，密钥错误或数据已篡改")
	}

	return string(plaintext), nil
}

// EncryptBytes 加密字节数组，返回 base64 编码字符串
func (c *AESCipher) EncryptBytes(data []byte) (string, error) {
	return c.Encrypt(string(data))
}

// DecryptBytes 解密 base64 字符串，返回字节数组
func (c *AESCipher) DecryptBytes(encoded string) ([]byte, error) {
	plain, err := c.Decrypt(encoded)
	if err != nil {
		return nil, err
	}
	return []byte(plain), nil
}
