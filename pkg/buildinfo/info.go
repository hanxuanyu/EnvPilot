package buildinfo

import "strings"

var (
	Version = "dev"
	Commit  = "unknown"
)

func NormalizedVersion() string {
	value := strings.TrimSpace(Version)
	if value == "" {
		return "dev"
	}
	return value
}

func NormalizedCommit() string {
	value := strings.TrimSpace(Commit)
	if value == "" {
		return "unknown"
	}
	return value
}
