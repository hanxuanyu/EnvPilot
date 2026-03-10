package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"html"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"EnvPilot/internal/buildmeta"
)

type wailsConfig struct {
	Info struct {
		Comments string `json:"comments"`
	} `json:"info"`
}

type embeddedMetadata struct {
	Version        string `json:"version"`
	Commit         string `json:"commit"`
	ProductVersion string `json:"product_version"`
}

func main() {
	mode := flag.String("mode", "sync", "sync|version|commit")
	flag.Parse()

	repoRoot, err := buildmeta.RepoRoot("")
	if err != nil {
		fail(err)
	}

	config, err := readWailsConfig(filepath.Join(repoRoot, "wails.json"))
	if err != nil {
		fail(err)
	}

	metadata := buildmeta.Resolve(repoRoot, config.Info.Comments)

	switch strings.TrimSpace(*mode) {
	case "sync":
		if err := sync(repoRoot, metadata); err != nil {
			fail(err)
		}
	case "version":
		fmt.Print(metadata.Version)
	case "commit":
		fmt.Print(metadata.Commit)
	default:
		fail(fmt.Errorf("不支持的模式: %s", *mode))
	}
}

func sync(repoRoot string, metadata buildmeta.Metadata) error {
	if err := writeEmbeddedMetadata(repoRoot, metadata); err != nil {
		return err
	}

	targets := []struct {
		templatePath string
		outputPath   string
	}{
		{templatePath: filepath.Join(repoRoot, "build/templates/darwin/Info.plist.tmpl"), outputPath: filepath.Join(repoRoot, "build/darwin/Info.plist")},
		{templatePath: filepath.Join(repoRoot, "build/templates/darwin/Info.dev.plist.tmpl"), outputPath: filepath.Join(repoRoot, "build/darwin/Info.dev.plist")},
		{templatePath: filepath.Join(repoRoot, "build/templates/windows/info.json.tmpl"), outputPath: filepath.Join(repoRoot, "build/windows/info.json")},
		{templatePath: filepath.Join(repoRoot, "build/templates/windows/wails.exe.manifest.tmpl"), outputPath: filepath.Join(repoRoot, "build/windows/wails.exe.manifest")},
		{templatePath: filepath.Join(repoRoot, "build/templates/windows/installer/project.nsi.tmpl"), outputPath: filepath.Join(repoRoot, "build/windows/installer/project.nsi")},
	}

	for _, target := range targets {
		if err := renderTemplate(target.templatePath, target.outputPath, metadata); err != nil {
			return err
		}
	}

	return nil
}

func writeEmbeddedMetadata(repoRoot string, metadata buildmeta.Metadata) error {
	content, err := json.MarshalIndent(embeddedMetadata{
		Version:        metadata.Version,
		Commit:         metadata.Commit,
		ProductVersion: metadata.ProductVersion,
	}, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化构建元信息失败: %w", err)
	}
	content = append(content, '\n')

	targetPath := filepath.Join(repoRoot, "pkg/buildinfo/assets/override.json")
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return fmt.Errorf("创建构建元信息目录失败: %w", err)
	}
	if err := os.WriteFile(targetPath, content, 0o644); err != nil {
		return fmt.Errorf("写入构建元信息失败: %w", err)
	}
	return nil
}

func renderTemplate(templatePath string, outputPath string, metadata buildmeta.Metadata) error {
	content, err := os.ReadFile(templatePath)
	if err != nil {
		return fmt.Errorf("读取模板失败 %s: %w", templatePath, err)
	}

	tmpl, err := template.New(filepath.Base(templatePath)).Delims("[[", "]]").Funcs(template.FuncMap{
		"json": func(value string) string {
			encoded, _ := json.Marshal(value)
			return string(encoded)
		},
		"xml": func(value string) string {
			return html.EscapeString(value)
		},
	}).Parse(string(content))
	if err != nil {
		return fmt.Errorf("解析模板失败 %s: %w", templatePath, err)
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return fmt.Errorf("创建输出目录失败 %s: %w", outputPath, err)
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("创建输出文件失败 %s: %w", outputPath, err)
	}
	defer file.Close()

	if err := tmpl.Execute(file, metadata); err != nil {
		return fmt.Errorf("渲染模板失败 %s: %w", outputPath, err)
	}

	return nil
}

func readWailsConfig(path string) (wailsConfig, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return wailsConfig{}, fmt.Errorf("读取 wails.json 失败: %w", err)
	}

	var config wailsConfig
	if err := json.Unmarshal(content, &config); err != nil {
		return wailsConfig{}, fmt.Errorf("解析 wails.json 失败: %w", err)
	}
	return config, nil
}

func fail(err error) {
	_, _ = fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
