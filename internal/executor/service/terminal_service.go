package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"sync"

	sshpkg "EnvPilot/internal/executor/ssh"
	"EnvPilot/pkg/logger"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"go.uber.org/zap"
	gossh "golang.org/x/crypto/ssh"
)

// TerminalSession 活跃的 SSH 终端会话
type TerminalSession struct {
	ID       string
	AssetID  uint
	session  *gossh.Session
	stdin    io.WriteCloser
	wailsCtx context.Context // 用于向前端推送事件
	cancel   context.CancelFunc
}

// TerminalService 在线终端会话管理服务（Task 3.5）
type TerminalService struct {
	mu       sync.Mutex
	sessions map[string]*TerminalSession
	pool     *sshpkg.Pool
	log      *zap.Logger
}

// NewTerminalService 创建终端服务
func NewTerminalService(pool *sshpkg.Pool) *TerminalService {
	return &TerminalService{
		sessions: make(map[string]*TerminalSession),
		pool:     pool,
		log:      logger.Named("terminal"),
	}
}

// StartTerminal 启动一个 SSH PTY 会话，返回 sessionID
//
// ctx 为 Wails 自动注入的应用上下文，用于 EventsEmit。
func (s *TerminalService) StartTerminal(ctx context.Context, assetID uint) (string, error) {
	client, err := s.pool.GetClient(assetID)
	if err != nil {
		return "", fmt.Errorf("SSH 连接失败: %w", err)
	}

	session, err := client.NewSession()
	if err != nil {
		s.pool.Remove(assetID)
		return "", fmt.Errorf("创建 SSH 会话失败: %w", err)
	}

	stdin, err := session.StdinPipe()
	if err != nil {
		session.Close()
		return "", fmt.Errorf("获取 stdin 管道失败: %w", err)
	}

	stdout, err := session.StdoutPipe()
	if err != nil {
		session.Close()
		return "", fmt.Errorf("获取 stdout 管道失败: %w", err)
	}

	modes := gossh.TerminalModes{
		gossh.ECHO:          1,
		gossh.TTY_OP_ISPEED: 14400,
		gossh.TTY_OP_OSPEED: 14400,
	}
	if err := session.RequestPty("xterm-256color", 24, 80, modes); err != nil {
		session.Close()
		return "", fmt.Errorf("请求 PTY 失败: %w", err)
	}

	if err := session.Shell(); err != nil {
		session.Close()
		return "", fmt.Errorf("启动 Shell 失败: %w", err)
	}

	sessionCtx, cancel := context.WithCancel(context.Background())
	sessionID := generateSessionID()

	ts := &TerminalSession{
		ID:       sessionID,
		AssetID:  assetID,
		session:  session,
		stdin:    stdin,
		wailsCtx: ctx,
		cancel:   cancel,
	}

	s.mu.Lock()
	s.sessions[sessionID] = ts
	s.mu.Unlock()

	go s.readOutput(sessionCtx, ts, stdout)

	s.log.Info("终端会话已启动",
		zap.String("sessionID", sessionID),
		zap.Uint("assetID", assetID),
	)
	return sessionID, nil
}

// SendInput 将键盘输入发送到终端会话
func (s *TerminalService) SendInput(sessionID, data string) error {
	s.mu.Lock()
	ts, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("终端会话不存在 [id=%s]", sessionID)
	}
	_, err := ts.stdin.Write([]byte(data))
	return err
}

// ResizeTerminal 调整终端窗口大小
func (s *TerminalService) ResizeTerminal(sessionID string, cols, rows uint32) error {
	s.mu.Lock()
	ts, ok := s.sessions[sessionID]
	s.mu.Unlock()
	if !ok {
		return fmt.Errorf("终端会话不存在 [id=%s]", sessionID)
	}
	return ts.session.WindowChange(int(rows), int(cols))
}

// CloseTerminal 关闭终端会话
func (s *TerminalService) CloseTerminal(sessionID string) {
	s.closeSession(sessionID)
}

// CloseAll 关闭所有活跃会话（应用退出时调用）
func (s *TerminalService) CloseAll() {
	s.mu.Lock()
	ids := make([]string, 0, len(s.sessions))
	for id := range s.sessions {
		ids = append(ids, id)
	}
	s.mu.Unlock()
	for _, id := range ids {
		s.closeSession(id)
	}
}

// closeSession 内部关闭单个会话
func (s *TerminalService) closeSession(sessionID string) {
	s.mu.Lock()
	ts, ok := s.sessions[sessionID]
	if ok {
		delete(s.sessions, sessionID)
	}
	s.mu.Unlock()

	if !ok {
		return
	}

	ts.cancel()
	_ = ts.stdin.Close()
	_ = ts.session.Close()

	runtime.EventsEmit(ts.wailsCtx, "terminal:closed:"+sessionID, nil)
	s.log.Info("终端会话已关闭", zap.String("sessionID", sessionID))
}

// readOutput 持续读取 SSH PTY 输出并通过 Wails 事件推送到前端
//
// 输出以 base64 编码确保二进制安全传输。
func (s *TerminalService) readOutput(ctx context.Context, ts *TerminalSession, stdout io.Reader) {
	event := "terminal:output:" + ts.ID
	buf := make([]byte, 4096)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		n, err := stdout.Read(buf)
		if n > 0 {
			data := base64.StdEncoding.EncodeToString(buf[:n])
			runtime.EventsEmit(ts.wailsCtx, event, data)
		}
		if err != nil {
			// EOF 或会话关闭时退出循环
			break
		}
	}

	s.closeSession(ts.ID)
}

// generateSessionID 生成随机会话 ID
func generateSessionID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
