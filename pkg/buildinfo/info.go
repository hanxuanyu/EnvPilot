package buildinfo

import (
	"embed"
	"encoding/json"
	"runtime/debug"
	"strings"
)

type metadata struct {
	Version        string `json:"version"`
	Commit         string `json:"commit"`
	ProductVersion string `json:"product_version,omitempty"`
}

//go:embed assets/*.json
var metadataFiles embed.FS

var current = loadMetadata()

var (
	Version = current.Version
	Commit  = current.Commit
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

func loadMetadata() metadata {
	resolved := mergeMetadata(
		readMetadataFile("assets/default.json"),
		readRuntimeMetadata(),
		readMetadataFile("assets/override.json"),
	)

	if strings.TrimSpace(resolved.Version) == "" {
		resolved.Version = "dev"
	}
	if strings.TrimSpace(resolved.Commit) == "" {
		resolved.Commit = "unknown"
	}

	return resolved
}

func mergeMetadata(sources ...metadata) metadata {
	merged := metadata{}
	for _, source := range sources {
		if value := strings.TrimSpace(source.Version); value != "" {
			merged.Version = value
		}
		if value := strings.TrimSpace(source.Commit); value != "" {
			merged.Commit = value
		}
		if value := strings.TrimSpace(source.ProductVersion); value != "" {
			merged.ProductVersion = value
		}
	}
	return merged
}

func readMetadataFile(name string) metadata {
	content, err := metadataFiles.ReadFile(name)
	if err != nil {
		return metadata{}
	}

	var value metadata
	if err := json.Unmarshal(content, &value); err != nil {
		return metadata{}
	}
	return value
}

func readRuntimeMetadata() metadata {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return metadata{}
	}

	resolved := metadata{}
	for _, setting := range info.Settings {
		if setting.Key == "vcs.revision" {
			resolved.Commit = shortCommit(setting.Value)
		}
	}

	return resolved
}

func shortCommit(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) > 7 {
		return trimmed[:7]
	}
	return trimmed
}
