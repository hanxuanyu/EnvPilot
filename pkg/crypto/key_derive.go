// key_derive.go 密钥派生工具
//
// 设计目的：
//   - 从用户主密码派生出固定长度的 AES 密钥
//   - 使用 PBKDF2-SHA256 算法：业界标准的密码哈希/派生方案
//   - salt 防止彩虹表攻击；高迭代次数增加暴力破解成本
//
// 使用方式：
//
//	// 首次设置主密码时生成 salt 并保存
//	salt := crypto.GenerateSalt()
//	key := crypto.DeriveKey("user-master-password", salt)
//	cipher, _ := crypto.NewAESCipher(key)
package crypto

import (
	"crypto/rand"
	"crypto/sha256"

	"golang.org/x/crypto/pbkdf2"
)

const (
	// pbkdf2Iterations PBKDF2 迭代次数，值越大越安全但越慢
	// 100000 次在现代硬件上约 100ms，对用户无感知但暴力破解成本极高
	pbkdf2Iterations = 100000

	// keyLength AES-256 需要 32 字节密钥
	keyLength = 32

	// saltLength salt 长度，16 字节（128 位）
	saltLength = 16
)

// DeriveKey 从密码和 salt 派生 32 字节 AES-256 密钥。
// 使用 PBKDF2-SHA256 算法，迭代 100000 次。
//
// 参数：
//   - password: 用户主密码（明文）
//   - salt: 随机盐值（通过 GenerateSalt 生成，需持久化存储）
func DeriveKey(password string, salt []byte) []byte {
	return pbkdf2.Key([]byte(password), salt, pbkdf2Iterations, keyLength, sha256.New)
}

// GenerateSalt 生成随机盐值（16 字节）。
// 每个用户/安装实例应生成一次并持久化存储。
func GenerateSalt() ([]byte, error) {
	salt := make([]byte, saltLength)
	_, err := rand.Read(salt)
	if err != nil {
		return nil, err
	}
	return salt, nil
}

// NewCipherFromPassword 一步完成：从密码和 salt 创建 AES 加密器。
// 适合在应用启动时使用。
func NewCipherFromPassword(password string, salt []byte) (*AESCipher, error) {
	key := DeriveKey(password, salt)
	return NewAESCipher(key)
}
