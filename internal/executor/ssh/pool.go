// Package ssh 提供 SSH 连接池，复用同一资产的 SSH 连接，减少重复握手开销。
package ssh

import (
	"fmt"
	"sync"
	"time"

	assetModel "EnvPilot/internal/asset/model"
	assetRepo "EnvPilot/internal/asset/repository"
	assetSvc "EnvPilot/internal/asset/service"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
	gossh "golang.org/x/crypto/ssh"
)

// poolEntry 连接池条目
type poolEntry struct {
	client   *gossh.Client
	lastUsed time.Time
}

// Pool SSH 连接池，按 assetID 键控缓存连接
type Pool struct {
	mu          sync.Mutex
	conns       map[uint]*poolEntry
	assetRepo   *assetRepo.AssetRepo
	credSvc     *assetSvc.CredentialService
	log         *zap.Logger
	idleTimeout time.Duration
}

// NewPool 创建 SSH 连接池
func NewPool(ar *assetRepo.AssetRepo, cs *assetSvc.CredentialService) *Pool {
	p := &Pool{
		conns:       make(map[uint]*poolEntry),
		assetRepo:   ar,
		credSvc:     cs,
		log:         logger.Named("ssh_pool"),
		idleTimeout: 30 * time.Minute,
	}
	go p.cleanupLoop()
	return p
}

// GetClient 获取（复用或新建）SSH 客户端
func (p *Pool) GetClient(assetID uint) (*gossh.Client, error) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if entry, ok := p.conns[assetID]; ok {
		if p.isAlive(entry.client) {
			entry.lastUsed = time.Now()
			return entry.client, nil
		}
		// 连接已失效，移除缓存
		_ = entry.client.Close()
		delete(p.conns, assetID)
	}

	client, err := p.dial(assetID)
	if err != nil {
		return nil, err
	}

	p.conns[assetID] = &poolEntry{client: client, lastUsed: time.Now()}
	return client, nil
}

// Remove 主动移除并关闭某资产的缓存连接
func (p *Pool) Remove(assetID uint) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if entry, ok := p.conns[assetID]; ok {
		_ = entry.client.Close()
		delete(p.conns, assetID)
	}
}

// CloseAll 关闭所有缓存连接（应用退出时调用）
func (p *Pool) CloseAll() {
	p.mu.Lock()
	defer p.mu.Unlock()
	for id, entry := range p.conns {
		_ = entry.client.Close()
		delete(p.conns, id)
	}
}

// dial 建立新的 SSH 连接
func (p *Pool) dial(assetID uint) (*gossh.Client, error) {
	asset, err := p.assetRepo.FindByID(assetID)
	if err != nil {
		return nil, fmt.Errorf("资产不存在 [id=%d]", assetID)
	}

	if asset.Type != assetModel.AssetTypeServer {
		return nil, fmt.Errorf("资产类型不支持 SSH [type=%s]", asset.Type)
	}

	if asset.CredentialID == nil {
		return nil, fmt.Errorf("资产未配置凭据，无法建立 SSH 连接 [id=%d]", assetID)
	}

	secret, err := p.credSvc.RevealSecret(*asset.CredentialID)
	if err != nil {
		return nil, fmt.Errorf("获取凭据失败: %w", err)
	}

	authMethod, err := buildAuth(asset.Credential, secret)
	if err != nil {
		return nil, fmt.Errorf("构建 SSH 认证失败: %w", err)
	}

	cfg := &gossh.ClientConfig{
		User:            asset.Credential.Username,
		Auth:            []gossh.AuthMethod{authMethod},
		HostKeyCallback: gossh.InsecureIgnoreHostKey(), // 内网运维工具，暂不校验 host key
		Timeout:         15 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", asset.Host, asset.Port)
	client, err := gossh.Dial("tcp", addr, cfg)
	if err != nil {
		return nil, fmt.Errorf("SSH 连接失败 [%s]: %w", addr, err)
	}

	p.log.Info("SSH 连接已建立", zap.Uint("assetID", assetID), zap.String("addr", addr))
	return client, nil
}

// buildAuth 根据凭据类型构建 SSH 认证方式
func buildAuth(cred *assetModel.Credential, secret string) (gossh.AuthMethod, error) {
	if cred == nil {
		return nil, fmt.Errorf("凭据信息为空")
	}
	switch cred.Type {
	case assetModel.CredentialTypePassword:
		return gossh.Password(secret), nil
	case assetModel.CredentialTypeSSHKey:
		signer, err := gossh.ParsePrivateKey([]byte(secret))
		if err != nil {
			return nil, fmt.Errorf("解析 SSH 私钥失败: %w", err)
		}
		return gossh.PublicKeys(signer), nil
	default:
		return nil, fmt.Errorf("不支持的凭据类型 [type=%s]", cred.Type)
	}
}

// isAlive 通过发送 keepalive 请求探测连接是否存活
func (p *Pool) isAlive(client *gossh.Client) bool {
	_, _, err := client.SendRequest("keepalive@openssh.com", true, nil)
	return err == nil
}

// cleanupLoop 定期清理超时空闲连接
func (p *Pool) cleanupLoop() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for range ticker.C {
		p.mu.Lock()
		now := time.Now()
		for id, entry := range p.conns {
			if now.Sub(entry.lastUsed) > p.idleTimeout {
				_ = entry.client.Close()
				delete(p.conns, id)
				p.log.Info("清理空闲 SSH 连接", zap.Uint("assetID", id))
			}
		}
		p.mu.Unlock()
	}
}
