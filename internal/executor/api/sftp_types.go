package executorapi

import "time"

type SFTPListRequest struct {
	AssetID uint   `json:"asset_id"`
	Path    string `json:"path"`
}

type SFTPPathRequest struct {
	AssetID uint   `json:"asset_id"`
	Path    string `json:"path"`
}

type SFTPMoveRequest struct {
	AssetID    uint   `json:"asset_id"`
	Path       string `json:"path"`
	TargetPath string `json:"target_path"`
	Overwrite  bool   `json:"overwrite"`
}

type SFTPUploadRequest struct {
	AssetID       uint   `json:"asset_id"`
	Path          string `json:"path"`
	ContentBase64 string `json:"content_base64"`
	Overwrite     bool   `json:"overwrite"`
}

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
	Name          string `json:"name"`
	Path          string `json:"path"`
	Size          int64  `json:"size"`
	ContentBase64 string `json:"content_base64"`
}
