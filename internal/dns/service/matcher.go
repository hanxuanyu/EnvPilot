package service

import (
	"regexp"
	"strings"
	"sync"

	"EnvPilot/internal/dns/model"
)

var (
	regexCache sync.Map // map[string]*regexp.Regexp
)

// matchesDomain 根据记录的匹配模式判断查询域名是否匹配
func matchesDomain(record model.DNSRecord, queryDomain string) bool {
	switch record.MatchMode {
	case model.MatchModeWildcard:
		return matchWildcard(record.Domain, queryDomain)
	case model.MatchModeRegex:
		return matchRegex(record.Domain, queryDomain)
	default:
		return record.Domain == queryDomain
	}
}

// matchWildcard 通配符匹配，支持 *.dev.local 格式
// *.dev.local 匹配 api.dev.local、web.dev.local（单级子域名）
// 不匹配 dev.local 本身，也不匹配 a.b.dev.local（多级）
func matchWildcard(pattern, domain string) bool {
	if !strings.HasPrefix(pattern, "*.") {
		return pattern == domain
	}
	suffix := pattern[1:] // ".dev.local"
	if !strings.HasSuffix(domain, suffix) {
		return false
	}
	prefix := strings.TrimSuffix(domain, suffix)
	return prefix != "" && !strings.Contains(prefix, ".")
}

// matchRegex 正则匹配，自动添加 ^...$ 锚定
// 已编译的正则会缓存以提升性能
func matchRegex(pattern, domain string) bool {
	re, ok := regexCache.Load(pattern)
	if !ok {
		compiled, err := regexp.Compile("^" + pattern + "$")
		if err != nil {
			return false
		}
		re, _ = regexCache.LoadOrStore(pattern, compiled)
	}
	return re.(*regexp.Regexp).MatchString(domain)
}

// validateWildcardPattern 校验通配符模式格式
func validateWildcardPattern(pattern string) bool {
	if !strings.HasPrefix(pattern, "*.") {
		return false
	}
	suffix := pattern[2:]
	return suffix != "" && !strings.HasPrefix(suffix, ".")
}

// validateRegexPattern 校验正则表达式是否合法
func validateRegexPattern(pattern string) bool {
	_, err := regexp.Compile("^" + pattern + "$")
	return err == nil
}
