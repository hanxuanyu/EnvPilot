package service

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	configSvc "EnvPilot/internal/config/service"
	"EnvPilot/pkg/crypto"
)

const (
	SessionCookieName       = "envpilot_auth_session"
	defaultPasswordFileName = ".masterpass"
	defaultSessionTTL       = 12 * time.Hour
)

var (
	ErrAuthRequired          = errors.New("需要输入主密码后才能执行该操作")
	ErrPasswordNotInitialized = errors.New("主密码尚未初始化，请先设置主密码")
	ErrInvalidPassword       = errors.New("主密码错误")
	ErrWeakPassword          = errors.New("主密码至少需要 8 个字符")
	ErrPasswordAlreadyExists = errors.New("主密码已设置，请使用修改密码")
)

type PasswordState struct {
	Verifier  string    `json:"verifier"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Status struct {
	Enabled     bool `json:"enabled"`
	Initialized bool `json:"initialized"`
	Unlocked    bool `json:"unlocked"`
	ReadOnly    bool `json:"read_only"`
	NeedsSetup  bool `json:"needs_setup"`
}

type Service struct {
	config       *configSvc.ConfigService
	dataDir      string
	passwordFile string
	sessionTTL   time.Duration

	mu              sync.RWMutex
	desktopUnlocked bool
	sessions        map[string]time.Time
}

func NewService(config *configSvc.ConfigService, dataDir string) *Service {
	return &Service{
		config:       config,
		dataDir:      dataDir,
		passwordFile: filepath.Join(dataDir, defaultPasswordFileName),
		sessionTTL:   defaultSessionTTL,
		sessions:     make(map[string]time.Time),
	}
}

func (s *Service) GetStatus(sessionID string) Status {
	enabled := s.isEnabled()
	initialized := s.isInitialized()
	unlocked := !enabled || s.isSessionUnlocked(sessionID)
	return Status{
		Enabled:     enabled,
		Initialized: initialized,
		Unlocked:    unlocked,
		ReadOnly:    enabled && !unlocked,
		NeedsSetup:  enabled && !initialized,
	}
}

func (s *Service) Setup(sessionID, password string) (Status, error) {
	if s.isInitialized() {
		return s.GetStatus(sessionID), ErrPasswordAlreadyExists
	}
	if err := validatePassword(password); err != nil {
		return s.GetStatus(sessionID), err
	}
	if err := s.writePasswordState(password); err != nil {
		return s.GetStatus(sessionID), err
	}
	s.markUnlocked(sessionID)
	return s.GetStatus(sessionID), nil
	}

func (s *Service) ChangePassword(sessionID, currentPassword, newPassword string) (Status, error) {
	if !s.isInitialized() {
		return s.GetStatus(sessionID), ErrPasswordNotInitialized
	}
	if !s.verifyPassword(currentPassword) {
		return s.GetStatus(sessionID), ErrInvalidPassword
	}
	if err := validatePassword(newPassword); err != nil {
		return s.GetStatus(sessionID), err
	}
	if err := s.writePasswordState(newPassword); err != nil {
		return s.GetStatus(sessionID), err
	}
	s.markUnlocked(sessionID)
	return s.GetStatus(sessionID), nil
	}

func (s *Service) Unlock(sessionID, password string) (Status, error) {
	if !s.isEnabled() {
		return s.GetStatus(sessionID), nil
	}
	if !s.isInitialized() {
		return s.GetStatus(sessionID), ErrPasswordNotInitialized
	}
	if !s.verifyPassword(password) {
		return s.GetStatus(sessionID), ErrInvalidPassword
	}
	s.markUnlocked(sessionID)
	return s.GetStatus(sessionID), nil
}

func (s *Service) Lock(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sessionID == "" {
		s.desktopUnlocked = false
		return
	}
	delete(s.sessions, sessionID)
}

func (s *Service) RequireAdmin(sessionID string) error {
	if !s.isEnabled() {
		return nil
	}
	if !s.isInitialized() {
		return ErrPasswordNotInitialized
	}
	if !s.isSessionUnlocked(sessionID) {
		return ErrAuthRequired
	}
	return nil
}

func (s *Service) RequireProtectedPage(sessionID string) error {
	if !s.isEnabled() || !s.isInitialized() {
		return nil
	}
	if !s.isSessionUnlocked(sessionID) {
		return ErrAuthRequired
	}
	return nil
}

func (s *Service) NewSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("生成会话失败: %w", err)
	}
	return hex.EncodeToString(b), nil
}

func (s *Service) isEnabled() bool {
	return s.config.Get().Security.MasterPasswordEnabled
}

func (s *Service) isInitialized() bool {
	_, err := s.readPasswordState()
	return err == nil
}

func (s *Service) isSessionUnlocked(sessionID string) bool {
	if !s.isEnabled() {
		return true
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for id, expiresAt := range s.sessions {
		if now.After(expiresAt) {
			delete(s.sessions, id)
		}
	}
	if sessionID == "" {
		return s.desktopUnlocked
	}
	expiresAt, ok := s.sessions[sessionID]
	return ok && now.Before(expiresAt)
}

func (s *Service) markUnlocked(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if sessionID == "" {
		s.desktopUnlocked = true
		return
	}
	s.sessions[sessionID] = time.Now().Add(s.sessionTTL)
}

func (s *Service) verifyPassword(password string) bool {
	state, err := s.readPasswordState()
	if err != nil {
		return false
	}
	verifier, err := s.deriveVerifier(password)
	if err != nil {
		return false
	}
	expected, err := base64.StdEncoding.DecodeString(state.Verifier)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare(expected, verifier) == 1
}

func (s *Service) writePasswordState(password string) error {
	verifier, err := s.deriveVerifier(password)
	if err != nil {
		return err
	}
	state := PasswordState{
		Verifier:  base64.StdEncoding.EncodeToString(verifier),
		UpdatedAt: time.Now(),
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化主密码状态失败: %w", err)
	}
	if err := os.MkdirAll(s.dataDir, 0755); err != nil {
		return fmt.Errorf("创建数据目录失败: %w", err)
	}
	if err := os.WriteFile(s.passwordFile, data, 0600); err != nil {
		return fmt.Errorf("保存主密码状态失败: %w", err)
	}
	return nil
}

func (s *Service) readPasswordState() (*PasswordState, error) {
	data, err := os.ReadFile(s.passwordFile)
	if err != nil {
		return nil, err
	}
	var state PasswordState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("解析主密码状态失败: %w", err)
	}
	if state.Verifier == "" {
		return nil, errors.New("主密码校验信息缺失")
	}
	return &state, nil
}

func (s *Service) deriveVerifier(password string) ([]byte, error) {
	saltPath := filepath.Join(s.dataDir, s.config.Get().Security.SaltFile)
	salt, err := os.ReadFile(saltPath)
	if err != nil {
		return nil, fmt.Errorf("读取 salt 失败: %w", err)
	}
	key := crypto.DeriveKey(password, salt)
	sum := sha256.Sum256(key)
	buf := make([]byte, len(sum))
	copy(buf, sum[:])
	return buf, nil
}

func validatePassword(password string) error {
	trimmed := strings.TrimSpace(password)
	if len([]rune(trimmed)) < 8 {
		return ErrWeakPassword
	}
	return nil
}