package crypto

import (
	"testing"
)

// TestAESEncryptDecrypt 验证加密后可以正确解密
func TestAESEncryptDecrypt(t *testing.T) {
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}

	c, err := NewAESCipher(key)
	if err != nil {
		t.Fatalf("创建 AES 加密器失败: %v", err)
	}

	testCases := []string{
		"simple-password",
		"复杂密码123!@#",
		"ssh-rsa AAAA...私钥内容",
		"",
	}

	for _, plain := range testCases {
		encrypted, err := c.Encrypt(plain)
		if err != nil {
			t.Errorf("加密失败 [%s]: %v", plain, err)
			continue
		}

		decrypted, err := c.Decrypt(encrypted)
		if err != nil {
			t.Errorf("解密失败 [%s]: %v", plain, err)
			continue
		}

		if decrypted != plain {
			t.Errorf("加解密结果不匹配: 期望 %q，实际 %q", plain, decrypted)
		}
	}
}

// TestAESNonceRandom 验证相同明文每次加密结果不同（nonce 随机性）
func TestAESNonceRandom(t *testing.T) {
	key := make([]byte, 32)
	c, _ := NewAESCipher(key)

	enc1, _ := c.Encrypt("test")
	enc2, _ := c.Encrypt("test")

	if enc1 == enc2 {
		t.Error("相同明文加密结果应不同（nonce 随机），但结果相同")
	}
}

// TestDeriveKey 验证密钥派生确定性（相同输入产生相同密钥）
func TestDeriveKey(t *testing.T) {
	password := "master-password"
	salt := []byte("fixed-salt-16byt")

	key1 := DeriveKey(password, salt)
	key2 := DeriveKey(password, salt)

	if string(key1) != string(key2) {
		t.Error("相同密码和 salt 应产生相同密钥")
	}

	if len(key1) != 32 {
		t.Errorf("派生密钥长度应为 32，实际 %d", len(key1))
	}
}
