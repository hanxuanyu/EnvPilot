package buildmeta

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

type Metadata struct {
	Version         string
	Commit          string
	ProductVersion  string
	ManifestVersion string
	Comments        string
}

var semverCorePattern = regexp.MustCompile(`^v?(\d+\.\d+\.\d+)`)

func RepoRoot(start string) (string, error) {
	base := strings.TrimSpace(start)
	if base == "" {
		cwd, err := os.Getwd()
		if err != nil {
			return "", fmt.Errorf("读取工作目录失败: %w", err)
		}
		base = cwd
	}

	path, err := filepath.Abs(base)
	if err != nil {
		return "", fmt.Errorf("解析工作目录失败: %w", err)
	}

	for {
		if fileExists(filepath.Join(path, "go.mod")) && fileExists(filepath.Join(path, "wails.json")) {
			return path, nil
		}

		parent := filepath.Dir(path)
		if parent == path {
			return "", fmt.Errorf("未找到仓库根目录")
		}
		path = parent
	}
}

func Resolve(repoRoot string, baseComments string) Metadata {
	version := firstNonEmpty(
		strings.TrimSpace(os.Getenv("ENVPILOT_VERSION")),
		detectVersion(repoRoot),
		"dev",
	)
	commit := firstNonEmpty(
		shortCommit(strings.TrimSpace(os.Getenv("ENVPILOT_COMMIT"))),
		shortCommit(strings.TrimSpace(os.Getenv("GITHUB_SHA"))),
		detectCommit(repoRoot),
		"unknown",
	)
	productVersion := firstNonEmpty(
		strings.TrimSpace(os.Getenv("ENVPILOT_PRODUCT_VERSION")),
		NormalizeProductVersion(version),
	)
	comments := strings.TrimSpace(baseComments)
	if comments == "" {
		comments = "Built using Wails"
	}
	if commit != "unknown" {
		comments = fmt.Sprintf("%s (commit %s)", comments, commit)
	}

	return Metadata{
		Version:         version,
		Commit:          commit,
		ProductVersion:  productVersion,
		ManifestVersion: NormalizeManifestVersion(productVersion),
		Comments:        comments,
	}
}

func NormalizeProductVersion(version string) string {
	matches := semverCorePattern.FindStringSubmatch(strings.TrimSpace(version))
	if len(matches) == 2 {
		return matches[1]
	}
	return "0.0.0"
}

func NormalizeManifestVersion(productVersion string) string {
	trimmed := strings.TrimSpace(productVersion)
	if trimmed == "" {
		return "0.0.0.0"
	}
	if strings.Count(trimmed, ".") == 2 {
		return trimmed + ".0"
	}
	if strings.Count(trimmed, ".") == 3 {
		return trimmed
	}
	return "0.0.0.0"
}

func detectVersion(repoRoot string) string {
	value, err := gitOutput(repoRoot, "describe", "--tags", "--exact-match", "HEAD")
	if err != nil {
		return ""
	}
	return value
}

func detectCommit(repoRoot string) string {
	value, err := gitOutput(repoRoot, "rev-parse", "--short", "HEAD")
	if err != nil {
		return ""
	}
	return shortCommit(value)
}

func gitOutput(repoRoot string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = repoRoot
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	output, err := cmd.Output()
	if err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return "", fmt.Errorf("git %s 失败: %s", strings.Join(args, " "), message)
	}
	return strings.TrimSpace(string(output)), nil
}

func shortCommit(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) > 7 {
		return trimmed[:7]
	}
	return trimmed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func fileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}
