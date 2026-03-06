package ssh

import (
	"regexp"
	"strings"
)

// dangerousPatterns 高危命令正则模式列表（Task 3.7 危险命令拦截）
var dangerousPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)\brm\s+(-[^\s]*r|-r[^\s]*)`),           // rm -rf, rm -r 等
	regexp.MustCompile(`(?i)\bmkfs\b`),                              // mkfs 磁盘格式化
	regexp.MustCompile(`(?i)\bdd\s+if=`),                            // dd 设备级写入
	regexp.MustCompile(`:\(\)\s*\{.*:\|.*&`),                        // fork bomb
	regexp.MustCompile(`(?i)\b(shutdown|reboot|halt|poweroff)\b`),   // 关机/重启
	regexp.MustCompile(`(?i)\bchmod\s+[0-9]*7[0-9]*\s+/`),          // 根目录危险权限
	regexp.MustCompile(`(?i)>\s*/dev/(sd[a-z]|hd[a-z]|nvme[0-9])`), // 写入块设备
	regexp.MustCompile(`(?i)\btruncate\s+-s\s+0\s+/`),               // 清空系统文件
}

// IsDangerous 检查命令是否匹配高危模式
func IsDangerous(command string) bool {
	cmd := strings.TrimSpace(command)
	for _, pattern := range dangerousPatterns {
		if pattern.MatchString(cmd) {
			return true
		}
	}
	return false
}
