package service

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"strconv"
	"strings"
	"time"

	assetRepo "EnvPilot/internal/asset/repository"
	auditSvc "EnvPilot/internal/audit/service"
	sshpkg "EnvPilot/internal/executor/ssh"
	"EnvPilot/pkg/logger"

	pkgsftp "github.com/pkg/sftp"
	"go.uber.org/zap"
)

const MaxInlineSFTPUploadFormMemory int64 = 32 << 20

var ErrSFTPTargetExists = errors.New("目标已存在")

type SFTPEntry struct {
	Name    string    `json:"name"`
	Path    string    `json:"path"`
	IsDir   bool      `json:"is_dir"`
	Size    int64     `json:"size"`
	Mode    string    `json:"mode"`
	Owner   string    `json:"owner,omitempty"`
	Group   string    `json:"group,omitempty"`
	ModTime time.Time `json:"mod_time"`
}

type SFTPListResult struct {
	Path    string      `json:"path"`
	Home    string      `json:"home"`
	Parent  string      `json:"parent,omitempty"`
	Entries []SFTPEntry `json:"entries"`
}

type SFTPTransferResult struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

type SFTPDownloadResult struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	Content []byte `json:"content"`
}

type SFTPService struct {
	pool      *sshpkg.Pool
	assetRepo *assetRepo.AssetRepo
	audit     *auditSvc.AuditService
	log       *zap.Logger
}

func NewSFTPService(pool *sshpkg.Pool, assetRepo *assetRepo.AssetRepo, audit *auditSvc.AuditService) *SFTPService {
	return &SFTPService{
		pool:      pool,
		assetRepo: assetRepo,
		audit:     audit,
		log:       logger.Named("sftp"),
	}
}

func (s *SFTPService) ListDirectory(assetID uint, rawPath string) (*SFTPListResult, error) {
	client, closeClient, err := s.newClient(assetID)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_list_directory", false, err.Error(), map[string]any{"path": rawPath})
		return nil, err
	}
	defer closeClient()

	home, err := s.homePath(client)
	if err != nil {
		return nil, err
	}

	resolvedPath, err := s.resolveExistingPath(client, rawPath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_list_directory", false, err.Error(), map[string]any{"path": rawPath})
		return nil, fmt.Errorf("读取目录失败: %w", err)
	}

	entries, err := client.ReadDir(resolvedPath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_list_directory", false, err.Error(), map[string]any{"path": resolvedPath})
		return nil, fmt.Errorf("读取目录失败: %w", err)
	}

	items := make([]SFTPEntry, 0, len(entries))
	for _, entry := range entries {
		owner, group := extractSFTPOwnerGroup(entry)
		items = append(items, SFTPEntry{
			Name:    entry.Name(),
			Path:    path.Join(resolvedPath, entry.Name()),
			IsDir:   entry.IsDir(),
			Size:    entry.Size(),
			Mode:    entry.Mode().String(),
			Owner:   owner,
			Group:   group,
			ModTime: entry.ModTime(),
		})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].IsDir != items[j].IsDir {
			return items[i].IsDir
		}
		return strings.ToLower(items[i].Name) < strings.ToLower(items[j].Name)
	})

	parent := path.Dir(resolvedPath)
	if parent == resolvedPath || resolvedPath == "/" {
		parent = ""
	}

	result := &SFTPListResult{
		Path:    resolvedPath,
		Home:    home,
		Parent:  parent,
		Entries: items,
	}
	s.recordAssetAudit(assetID, "sftp_list_directory", true, "列出远端目录成功", map[string]any{"path": resolvedPath, "entry_count": len(items)})
	return result, nil
}

type sftpFileInfoOwnerGroup interface {
	Uid() uint32
	Gid() uint32
}

func extractSFTPOwnerGroup(entry os.FileInfo) (string, string) {
	if stat, ok := entry.Sys().(*pkgsftp.FileStat); ok {
		return strconv.FormatUint(uint64(stat.UID), 10), strconv.FormatUint(uint64(stat.GID), 10)
	}
	if info, ok := entry.(sftpFileInfoOwnerGroup); ok {
		return strconv.FormatUint(uint64(info.Uid()), 10), strconv.FormatUint(uint64(info.Gid()), 10)
	}
	return "", ""
}

func (s *SFTPService) UploadFile(assetID uint, remotePath string, content io.Reader, overwrite bool) (*SFTPTransferResult, error) {
	client, closeClient, err := s.newClient(assetID)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_upload_file", false, err.Error(), map[string]any{"path": remotePath})
		return nil, err
	}
	defer closeClient()

	targetPath, err := s.resolveTargetPath(client, remotePath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_upload_file", false, err.Error(), map[string]any{"path": remotePath})
		return nil, err
	}
	if targetPath == "/" {
		return nil, fmt.Errorf("目标路径无效")
	}
	if err := s.ensureUploadTargetWritable(client, targetPath, overwrite); err != nil {
		s.recordAssetAudit(assetID, "sftp_upload_file", false, err.Error(), map[string]any{"path": targetPath, "overwrite": overwrite})
		return nil, err
	}

	if err := client.MkdirAll(path.Dir(targetPath)); err != nil {
		s.recordAssetAudit(assetID, "sftp_upload_file", false, err.Error(), map[string]any{"path": targetPath})
		return nil, fmt.Errorf("创建远端目录失败: %w", err)
	}

	file, err := client.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_upload_file", false, err.Error(), map[string]any{"path": targetPath})
		return nil, fmt.Errorf("打开远端文件失败: %w", err)
	}
	defer file.Close()

	written, err := io.Copy(file, content)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_upload_file", false, err.Error(), map[string]any{"path": targetPath})
		return nil, fmt.Errorf("上传文件失败: %w", err)
	}

	result := &SFTPTransferResult{Path: targetPath, Size: written}
	s.recordAssetAudit(assetID, "sftp_upload_file", true, "上传远端文件成功", map[string]any{"path": targetPath, "size": written, "overwrite": overwrite})
	return result, nil
}

func (s *SFTPService) DownloadFile(assetID uint, remotePath string) (*SFTPDownloadResult, error) {
	client, closeClient, err := s.newClient(assetID)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_download_file", false, err.Error(), map[string]any{"path": remotePath})
		return nil, err
	}
	defer closeClient()

	resolvedPath, err := s.resolveExistingPath(client, remotePath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_download_file", false, err.Error(), map[string]any{"path": remotePath})
		return nil, err
	}

	info, err := client.Stat(resolvedPath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_download_file", false, err.Error(), map[string]any{"path": resolvedPath})
		return nil, fmt.Errorf("读取远端文件信息失败: %w", err)
	}
	if info.IsDir() {
		return nil, fmt.Errorf("暂不支持下载目录")
	}

	file, err := client.Open(resolvedPath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_download_file", false, err.Error(), map[string]any{"path": resolvedPath})
		return nil, fmt.Errorf("打开远端文件失败: %w", err)
	}
	defer file.Close()

	var buf bytes.Buffer
	if _, err := io.Copy(&buf, file); err != nil {
		s.recordAssetAudit(assetID, "sftp_download_file", false, err.Error(), map[string]any{"path": resolvedPath})
		return nil, fmt.Errorf("读取远端文件失败: %w", err)
	}

	result := &SFTPDownloadResult{
		Name:    info.Name(),
		Path:    resolvedPath,
		Size:    info.Size(),
		Content: buf.Bytes(),
	}
	s.recordAssetAudit(assetID, "sftp_download_file", true, "下载远端文件成功", map[string]any{"path": resolvedPath, "size": info.Size()})
	return result, nil
}

func (s *SFTPService) CreateDirectory(assetID uint, remotePath string) (string, error) {
	client, closeClient, err := s.newClient(assetID)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_create_directory", false, err.Error(), map[string]any{"path": remotePath})
		return "", err
	}
	defer closeClient()

	targetPath, err := s.resolveTargetPath(client, remotePath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_create_directory", false, err.Error(), map[string]any{"path": remotePath})
		return "", err
	}

	if err := client.MkdirAll(targetPath); err != nil {
		s.recordAssetAudit(assetID, "sftp_create_directory", false, err.Error(), map[string]any{"path": targetPath})
		return "", fmt.Errorf("创建目录失败: %w", err)
	}

	s.recordAssetAudit(assetID, "sftp_create_directory", true, "创建远端目录成功", map[string]any{"path": targetPath})
	return targetPath, nil
}

func (s *SFTPService) DeletePath(assetID uint, remotePath string) error {
	client, closeClient, err := s.newClient(assetID)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_delete_path", false, err.Error(), map[string]any{"path": remotePath})
		return err
	}
	defer closeClient()

	resolvedPath, err := s.resolveExistingPath(client, remotePath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_delete_path", false, err.Error(), map[string]any{"path": remotePath})
		return err
	}

	info, err := client.Stat(resolvedPath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_delete_path", false, err.Error(), map[string]any{"path": resolvedPath})
		return fmt.Errorf("读取远端路径信息失败: %w", err)
	}

	if info.IsDir() {
		err = client.RemoveAll(resolvedPath)
	} else {
		err = client.Remove(resolvedPath)
	}
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_delete_path", false, err.Error(), map[string]any{"path": resolvedPath})
		return fmt.Errorf("删除远端路径失败: %w", err)
	}

	s.recordAssetAudit(assetID, "sftp_delete_path", true, "删除远端路径成功", map[string]any{"path": resolvedPath, "is_dir": info.IsDir()})
	return nil
}

func (s *SFTPService) MovePath(assetID uint, sourcePath string, targetPath string, overwrite bool) (*SFTPTransferResult, error) {
	client, closeClient, err := s.newClient(assetID)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": sourcePath, "target_path": targetPath})
		return nil, err
	}
	defer closeClient()

	resolvedSource, err := s.resolveExistingPath(client, sourcePath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": sourcePath, "target_path": targetPath})
		return nil, err
	}

	resolvedTarget, err := s.resolveTargetPath(client, targetPath)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": resolvedSource, "target_path": targetPath})
		return nil, err
	}
	if resolvedTarget == "/" {
		return nil, fmt.Errorf("目标路径无效")
	}
	if resolvedSource == resolvedTarget {
		return &SFTPTransferResult{Path: resolvedTarget}, nil
	}

	sourceInfo, err := client.Stat(resolvedSource)
	if err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": resolvedSource, "target_path": resolvedTarget})
		return nil, fmt.Errorf("读取源路径信息失败: %w", err)
	}

	if err := client.MkdirAll(path.Dir(resolvedTarget)); err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": resolvedSource, "target_path": resolvedTarget})
		return nil, fmt.Errorf("创建目标目录失败: %w", err)
	}

	if err := s.prepareMoveTarget(client, resolvedTarget, sourceInfo.IsDir(), overwrite); err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": resolvedSource, "target_path": resolvedTarget, "overwrite": overwrite})
		return nil, err
	}

	if err := client.Rename(resolvedSource, resolvedTarget); err != nil {
		s.recordAssetAudit(assetID, "sftp_move_path", false, err.Error(), map[string]any{"path": resolvedSource, "target_path": resolvedTarget, "overwrite": overwrite})
		return nil, fmt.Errorf("移动远端路径失败: %w", err)
	}

	result := &SFTPTransferResult{Path: resolvedTarget, Size: sourceInfo.Size()}
	s.recordAssetAudit(assetID, "sftp_move_path", true, "移动远端路径成功", map[string]any{"path": resolvedSource, "target_path": resolvedTarget, "overwrite": overwrite, "is_dir": sourceInfo.IsDir()})
	return result, nil
}

func (s *SFTPService) EncodeDownloadContent(result *SFTPDownloadResult) string {
	return base64.StdEncoding.EncodeToString(result.Content)
}

func (s *SFTPService) ensureUploadTargetWritable(client *pkgsftp.Client, targetPath string, overwrite bool) error {
	info, err := client.Stat(targetPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		if statusErr, ok := err.(*pkgsftp.StatusError); ok && statusErr.Code == uint32(pkgsftp.ErrSSHFxNoSuchFile) {
			return nil
		}
		return fmt.Errorf("检查目标路径失败: %w", err)
	}
	if info.IsDir() {
		return fmt.Errorf("目标路径是目录，无法覆盖: %s", targetPath)
	}
	if !overwrite {
		return fmt.Errorf("%w: %s", ErrSFTPTargetExists, targetPath)
	}
	return nil
}

func (s *SFTPService) prepareMoveTarget(client *pkgsftp.Client, targetPath string, sourceIsDir bool, overwrite bool) error {
	info, err := client.Stat(targetPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		if statusErr, ok := err.(*pkgsftp.StatusError); ok && statusErr.Code == uint32(pkgsftp.ErrSSHFxNoSuchFile) {
			return nil
		}
		return fmt.Errorf("检查目标路径失败: %w", err)
	}
	if !overwrite {
		return fmt.Errorf("%w: %s", ErrSFTPTargetExists, targetPath)
	}
	if info.IsDir() != sourceIsDir {
		return fmt.Errorf("目标路径类型与源路径不一致，无法覆盖")
	}
	if info.IsDir() {
		if err := client.RemoveAll(targetPath); err != nil {
			return fmt.Errorf("删除已存在目标目录失败: %w", err)
		}
		return nil
	}
	if err := client.Remove(targetPath); err != nil {
		return fmt.Errorf("删除已存在目标文件失败: %w", err)
	}
	return nil
}

func (s *SFTPService) newClient(assetID uint) (*pkgsftp.Client, func(), error) {
	sshClient, err := s.pool.GetClient(assetID)
	if err != nil {
		return nil, nil, fmt.Errorf("建立 SSH 连接失败: %w", err)
	}

	client, err := pkgsftp.NewClient(sshClient)
	if err != nil {
		return nil, nil, fmt.Errorf("建立 SFTP 会话失败: %w", err)
	}

	return client, func() {
		_ = client.Close()
	}, nil
}

func (s *SFTPService) homePath(client *pkgsftp.Client) (string, error) {
	home, err := client.Getwd()
	if err != nil {
		return "", fmt.Errorf("读取远端工作目录失败: %w", err)
	}
	return cleanRemotePath(home), nil
}

func (s *SFTPService) resolveExistingPath(client *pkgsftp.Client, rawPath string) (string, error) {
	targetPath, err := s.resolveTargetPath(client, rawPath)
	if err != nil {
		return "", err
	}
	resolvedPath, err := client.RealPath(targetPath)
	if err != nil {
		return "", fmt.Errorf("远端路径不存在: %w", err)
	}
	return cleanRemotePath(resolvedPath), nil
}

func (s *SFTPService) resolveTargetPath(client *pkgsftp.Client, rawPath string) (string, error) {
	home, err := s.homePath(client)
	if err != nil {
		return "", err
	}

	targetPath := strings.TrimSpace(strings.ReplaceAll(rawPath, `\\`, `/`))
	switch {
	case targetPath == "", targetPath == ".":
		targetPath = home
	case targetPath == "~":
		targetPath = home
	case strings.HasPrefix(targetPath, "~/"):
		targetPath = path.Join(home, strings.TrimPrefix(targetPath, "~/"))
	case !path.IsAbs(targetPath):
		targetPath = path.Join(home, targetPath)
	}

	return cleanRemotePath(targetPath), nil
}

func cleanRemotePath(value string) string {
	cleaned := path.Clean(strings.TrimSpace(value))
	if cleaned == "." {
		return "/"
	}
	if !strings.HasPrefix(cleaned, "/") {
		return "/" + strings.TrimPrefix(cleaned, "/")
	}
	return cleaned
}

func (s *SFTPService) recordAssetAudit(assetID uint, action string, success bool, detail string, result any) {
	if s.audit == nil {
		return
	}
	input := auditSvc.RecordInput{
		Module:       "executor",
		Action:       action,
		ResourceType: "asset",
		ResourceID:   uintPtr(assetID),
		Success:      success,
		Detail:       detail,
		Request: map[string]any{
			"asset_id": assetID,
		},
		Result: result,
	}
	if s.assetRepo != nil {
		if asset, err := s.assetRepo.FindByID(assetID); err == nil {
			input.ResourceName = asset.Name
			input.PluginType = asset.PluginType
		}
	}
	s.audit.RecordBestEffort(input)
}
