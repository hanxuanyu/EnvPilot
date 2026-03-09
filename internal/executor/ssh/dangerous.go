package ssh

import (
	"regexp"
	"strings"
	"sync"
)

var (
	dangerousPatternsMu sync.RWMutex
	dangerousPatterns   = mustCompileDangerousPatterns(defaultDangerousPatterns, nil)
)

var defaultDangerousPatterns = []string{
	`(?i)\brm\s+(-[^\s]*r|-r[^\s]*)`,
	`(?i)\bmkfs\b`,
	`(?i)\bdd\s+if=`,
	`:\(\)\s*\{.*:\|.*&`,
	`(?i)\b(shutdown|reboot|halt|poweroff)\b`,
	`(?i)\bchmod\s+[0-9]*7[0-9]*\s+/`,
	`(?i)>\s*/dev/(sd[a-z]|hd[a-z]|nvme[0-9])`,
	`(?i)\btruncate\s+-s\s+0\s+/`,
}

func UpdateDangerousPatterns(patterns []string) error {
	compiled, err := compileDangerousPatterns(defaultDangerousPatterns, patterns)
	if err != nil {
		return err
	}
	dangerousPatternsMu.Lock()
	dangerousPatterns = compiled
	dangerousPatternsMu.Unlock()
	return nil
}

// IsDangerous 检查命令是否匹配高危模式
func IsDangerous(command string) bool {
	cmd := strings.TrimSpace(command)
	dangerousPatternsMu.RLock()
	patterns := append([]*regexp.Regexp(nil), dangerousPatterns...)
	dangerousPatternsMu.RUnlock()
	for _, pattern := range patterns {
		if pattern.MatchString(cmd) {
			return true
		}
	}
	return false
}

func mustCompileDangerousPatterns(basePatterns []string, extraPatterns []string) []*regexp.Regexp {
	compiled, err := compileDangerousPatterns(basePatterns, extraPatterns)
	if err != nil {
		panic(err)
	}
	return compiled
}

func compileDangerousPatterns(basePatterns []string, extraPatterns []string) ([]*regexp.Regexp, error) {
	allPatterns := make([]string, 0, len(basePatterns)+len(extraPatterns))
	allPatterns = append(allPatterns, basePatterns...)
	for _, pattern := range extraPatterns {
		pattern = strings.TrimSpace(pattern)
		if pattern == "" {
			continue
		}
		if !strings.HasPrefix(pattern, "(?") {
			pattern = "(?i)" + pattern
		}
		allPatterns = append(allPatterns, pattern)
	}
	compiled := make([]*regexp.Regexp, 0, len(allPatterns))
	for _, pattern := range allPatterns {
		re, err := regexp.Compile(pattern)
		if err != nil {
			return nil, err
		}
		compiled = append(compiled, re)
	}
	return compiled, nil
}
