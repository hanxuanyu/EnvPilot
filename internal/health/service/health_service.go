package service

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	assetModel "EnvPilot/internal/asset/model"
	assetRepo "EnvPilot/internal/asset/repository"
	assetSvc "EnvPilot/internal/asset/service"
	auditSvc "EnvPilot/internal/audit/service"
	configModel "EnvPilot/internal/config/model"
	"EnvPilot/internal/connector"
	sshpkg "EnvPilot/internal/executor/ssh"
	healthModel "EnvPilot/internal/health/model"
	healthRepo "EnvPilot/internal/health/repository"
	"EnvPilot/internal/plugin"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type ListSnapshotsRequest struct {
	EnvironmentID uint
	Category      plugin.AssetCategory
	Status        healthModel.HealthStatus
	Keyword       string
	Limit         int
	Offset        int
}

type ListSnapshotsResult struct {
	Items []healthModel.HealthSnapshot `json:"items"`
	Total int64                        `json:"total"`
}

type SummaryResult struct {
	Total       int `json:"total"`
	Healthy     int `json:"healthy"`
	Warning     int `json:"warning"`
	Critical    int `json:"critical"`
	Unreachable int `json:"unreachable"`
	Unknown     int `json:"unknown"`
}

type CheckAllRequest struct {
	EnvironmentID uint
	Category      plugin.AssetCategory
	Trigger       string
}

type CheckAllResult struct {
	Checked int `json:"checked"`
}

type HealthService struct {
	repo      *healthRepo.HealthRepo
	assetRepo *assetRepo.AssetRepo
	credSvc   *assetSvc.CredentialService
	audit     *auditSvc.AuditService
	pool      *sshpkg.Pool
	cfg       configModel.HealthSection
	log       *zap.Logger
	cfgMu     sync.RWMutex

	schedulerMu     sync.Mutex
	schedulerCancel context.CancelFunc
	schedulerBusy   bool
}

func NewHealthService(
	repo *healthRepo.HealthRepo,
	assetRepo *assetRepo.AssetRepo,
	credSvc *assetSvc.CredentialService,
	audit *auditSvc.AuditService,
	pool *sshpkg.Pool,
	cfg configModel.HealthSection,
) *HealthService {
	return &HealthService{
		repo:      repo,
		assetRepo: assetRepo,
		credSvc:   credSvc,
		audit:     audit,
		pool:      pool,
		cfg:       cfg,
		log:       logger.Named("health"),
	}
}

func (s *HealthService) StartScheduler() {
	cfg := s.currentConfig()
	if !cfg.AutoCheck {
		s.log.Info("自动健康检查未启用")
		return
	}

	s.schedulerMu.Lock()
	if s.schedulerCancel != nil {
		s.schedulerMu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.schedulerCancel = cancel
	s.schedulerBusy = false
	interval := s.checkInterval()
	s.schedulerMu.Unlock()

	go s.schedulerLoop(ctx, interval)
	s.log.Info("自动健康检查已启动", zap.Duration("interval", interval), zap.Duration("timeout", s.checkTimeout()))
}

func (s *HealthService) UpdateConfig(cfg configModel.HealthSection) {
	s.cfgMu.Lock()
	s.cfg = cfg
	s.cfgMu.Unlock()
	s.StopScheduler()
	s.StartScheduler()
	s.log.Info("健康检查配置已热更新",
		zap.Int("check_interval", cfg.CheckInterval),
		zap.Int("timeout", cfg.Timeout),
		zap.Bool("auto_check", cfg.AutoCheck),
	)
}

func (s *HealthService) StopScheduler() {
	s.schedulerMu.Lock()
	cancel := s.schedulerCancel
	s.schedulerCancel = nil
	s.schedulerBusy = false
	s.schedulerMu.Unlock()

	if cancel != nil {
		cancel()
		s.log.Info("自动健康检查已停止")
	}
}

func (s *HealthService) CheckAsset(ctx context.Context, assetID uint) (*healthModel.HealthSnapshot, error) {
	asset, err := s.assetRepo.FindByID(assetID)
	if err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "health",
			Action:       "check_health",
			ResourceType: "asset",
			ResourceID:   uintPtr(assetID),
			Success:      false,
			Detail:       fmt.Sprintf("资产不存在 [id=%d]", assetID),
			Request: map[string]any{
				"asset_id": assetID,
				"mode":     "single",
			},
		})
		return nil, fmt.Errorf("资产不存在 [id=%d]", assetID)
	}
	snapshot, err := s.checkAndPersistAsset(ctx, asset)
	if err != nil {
		s.recordAssetAudit(asset, "check_health", false, err.Error(), map[string]any{
			"mode": "single",
		}, nil)
		return nil, err
	}
	s.recordAssetAudit(asset, "check_health", true, fmt.Sprintf("健康检查完成，状态=%s", snapshot.Status), map[string]any{
		"mode": "single",
	}, healthAuditResult(snapshot))
	return snapshot, nil
}

func (s *HealthService) checkAndPersistAsset(ctx context.Context, asset *assetModel.Asset) (*healthModel.HealthSnapshot, error) {
	ctx, cancel := context.WithTimeout(ctx, s.checkTimeout())
	defer cancel()

	snapshot := s.runChecks(ctx, asset)
	if err := s.repo.Create(snapshot); err != nil {
		return nil, fmt.Errorf("写入健康快照失败: %w", err)
	}
	if err := s.assetRepo.UpdateStatusCheckedAt(asset.ID, mapAssetStatus(snapshot.Status), snapshot.CheckedAt); err != nil {
		s.log.Warn("更新资产健康状态失败", zap.Uint("asset_id", asset.ID), zap.Error(err))
	}
	created, _, err := s.repo.ListLatest(healthRepo.LatestFilter{Limit: 1, Offset: 0, Keyword: asset.Name})
	if err == nil {
		for i := range created {
			if created[i].AssetID == asset.ID {
				return &created[i], nil
			}
		}
	}
	return snapshot, nil
}

func (s *HealthService) CheckAll(ctx context.Context, req CheckAllRequest) (*CheckAllResult, error) {
	assets, err := s.assetRepo.List(assetRepo.AssetFilter{
		EnvironmentID: req.EnvironmentID,
		Category:      req.Category,
	})
	if err != nil {
		s.recordAudit(auditSvc.RecordInput{
			Module:       "health",
			Action:       batchAuditAction(req.Trigger),
			ResourceType: "health",
			Success:      false,
			Detail:       fmt.Sprintf("查询资产失败: %v", err),
			Request: map[string]any{
				"environment_id": req.EnvironmentID,
				"category":       req.Category,
				"trigger":        normalizeCheckTrigger(req.Trigger),
			},
		})
		return nil, fmt.Errorf("查询资产失败: %w", err)
	}

	checked := 0
	failedAssetIDs := make([]uint, 0)
	for i := range assets {
		snapshot, err := s.checkAndPersistAsset(ctx, &assets[i])
		if err != nil {
			s.log.Warn("批量健康检查失败", zap.Uint("asset_id", assets[i].ID), zap.Error(err))
			failedAssetIDs = append(failedAssetIDs, assets[i].ID)
			if req.Trigger != "scheduled" {
				s.recordAssetAudit(&assets[i], "check_health", false, err.Error(), map[string]any{
					"mode":    "batch",
					"trigger": normalizeCheckTrigger(req.Trigger),
				}, nil)
			}
			continue
		}
		if req.Trigger != "scheduled" {
			s.recordAssetAudit(&assets[i], "check_health", true, fmt.Sprintf("健康检查完成，状态=%s", snapshot.Status), map[string]any{
				"mode":    "batch",
				"trigger": normalizeCheckTrigger(req.Trigger),
			}, healthAuditResult(snapshot))
		}
		checked++
	}
	s.recordAudit(auditSvc.RecordInput{
		Module:       "health",
		Action:       batchAuditAction(req.Trigger),
		ResourceType: "health",
		Success:      true,
		Detail:       fmt.Sprintf("批量健康检查完成：成功 %d，失败 %d", checked, len(failedAssetIDs)),
		Request: map[string]any{
			"environment_id": req.EnvironmentID,
			"category":       req.Category,
			"trigger":        normalizeCheckTrigger(req.Trigger),
		},
		Result: map[string]any{
			"checked":          checked,
			"failed":           len(failedAssetIDs),
			"failed_asset_ids": failedAssetIDs,
		},
	})
	return &CheckAllResult{Checked: checked}, nil
}

func (s *HealthService) ListSnapshots(req ListSnapshotsRequest) (*ListSnapshotsResult, error) {
	items, total, err := s.repo.ListLatest(healthRepo.LatestFilter(req))
	if err != nil {
		return nil, fmt.Errorf("查询健康快照失败: %w", err)
	}
	return &ListSnapshotsResult{Items: items, Total: total}, nil
}

func (s *HealthService) GetSummary(req ListSnapshotsRequest) (*SummaryResult, error) {
	items, _, err := s.repo.ListLatest(healthRepo.LatestFilter{
		EnvironmentID: req.EnvironmentID,
		Category:      req.Category,
		Status:        req.Status,
		Keyword:       req.Keyword,
		Limit:         500,
		Offset:        0,
	})
	if err != nil {
		return nil, fmt.Errorf("统计健康快照失败: %w", err)
	}
	summary := &SummaryResult{}
	for _, item := range items {
		summary.Total++
		switch item.Status {
		case healthModel.HealthStatusHealthy:
			summary.Healthy++
		case healthModel.HealthStatusWarning:
			summary.Warning++
		case healthModel.HealthStatusCritical:
			summary.Critical++
		case healthModel.HealthStatusUnreachable:
			summary.Unreachable++
		default:
			summary.Unknown++
		}
	}
	return summary, nil
}

func (s *HealthService) schedulerLoop(ctx context.Context, interval time.Duration) {
	timer := time.NewTimer(3 * time.Second)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			s.runScheduledCheck(ctx)
			timer.Reset(interval)
		}
	}
}

func (s *HealthService) runScheduledCheck(ctx context.Context) {
	if !s.beginScheduledRun() {
		return
	}
	defer s.endScheduledRun()

	startedAt := time.Now()
	result, err := s.CheckAll(ctx, CheckAllRequest{Trigger: "scheduled"})
	if err != nil {
		s.log.Warn("自动健康检查执行失败", zap.Error(err))
		return
	}

	s.log.Info("自动健康检查完成", zap.Int("checked", result.Checked), zap.Duration("duration", time.Since(startedAt)))
}

func (s *HealthService) beginScheduledRun() bool {
	s.schedulerMu.Lock()
	defer s.schedulerMu.Unlock()
	if s.schedulerCancel == nil || s.schedulerBusy {
		return false
	}
	s.schedulerBusy = true
	return true
}

func (s *HealthService) endScheduledRun() {
	s.schedulerMu.Lock()
	s.schedulerBusy = false
	s.schedulerMu.Unlock()
}

func (s *HealthService) runChecks(ctx context.Context, asset *assetModel.Asset) *healthModel.HealthSnapshot {
	snapshot := &healthModel.HealthSnapshot{
		AssetID:       asset.ID,
		EnvironmentID: asset.EnvironmentID,
		CheckType:     determineCheckType(asset),
		Status:        healthModel.HealthStatusUnknown,
		Metrics:       make(healthModel.Metrics),
		CheckedAt:     time.Now(),
	}

	host := asset.ExtConfig.GetString("host")
	port := normalizePort(asset)
	if host == "" {
		snapshot.Status = healthModel.HealthStatusCritical
		snapshot.Detail = "资产未配置 host，无法执行健康检查"
		return snapshot
	}

	tcpLatency, tcpErr := tcpCheck(ctx, host, port)
	snapshot.Metrics["host"] = host
	snapshot.Metrics["port"] = port
	if tcpErr != nil {
		snapshot.Status = healthModel.HealthStatusUnreachable
		snapshot.Detail = fmt.Sprintf("TCP 检查失败: %v", tcpErr)
		return snapshot
	}
	snapshot.LatencyMS = tcpLatency
	snapshot.Metrics["tcp_latency_ms"] = tcpLatency

	switch asset.Category {
	case plugin.CategoryDatabase, plugin.CategoryCache, plugin.CategoryMQ:
		return s.runConnectorChecks(ctx, asset, snapshot)
	case plugin.CategoryServer:
		return s.runServerChecks(ctx, asset, snapshot)
	default:
		snapshot.Status = healthModel.HealthStatusHealthy
		snapshot.Detail = "基础 TCP 检查通过"
		return snapshot
	}
}

func (s *HealthService) runConnectorChecks(ctx context.Context, asset *assetModel.Asset, snapshot *healthModel.HealthSnapshot) *healthModel.HealthSnapshot {
	target, err := s.resolveTarget(asset)
	if err != nil {
		snapshot.Status = healthModel.HealthStatusWarning
		snapshot.Detail = fmt.Sprintf("解析连接目标失败: %v", err)
		return snapshot
	}
	conn, err := connector.NewConnector(target)
	if err != nil {
		snapshot.Status = healthModel.HealthStatusWarning
		snapshot.Detail = fmt.Sprintf("初始化连接器失败: %v", err)
		return snapshot
	}
	defer conn.Close()

	if err := conn.Ping(ctx); err != nil {
		snapshot.Status = healthModel.HealthStatusWarning
		snapshot.Detail = fmt.Sprintf("TCP 可达，但连接器 Ping 失败: %v", err)
		return snapshot
	}

	snapshot.Metrics["connector_ping"] = true
	snapshot.Status = healthModel.HealthStatusHealthy
	snapshot.Detail = "TCP 与连接器 Ping 均正常"

	if probe, ok := conn.(connector.MetadataProbeConnector); ok {
		result, err := probe.ProbeMetadata(ctx)
		if err != nil {
			snapshot.Metrics["metadata_probe_error"] = err.Error()
			snapshot.Detail = fmt.Sprintf("连接正常，扩展只读探测受限: %v", err)
			return snapshot
		}
		mergeMetrics(snapshot.Metrics, result.Metrics)
		if result.Detail != "" {
			snapshot.Detail = result.Detail
			snapshot.CheckType = "connector_probe"
		}
	}

	return snapshot
}

func (s *HealthService) runServerChecks(ctx context.Context, asset *assetModel.Asset, snapshot *healthModel.HealthSnapshot) *healthModel.HealthSnapshot {
	if !supportsSSHMetrics(asset) {
		snapshot.Status = healthModel.HealthStatusHealthy
		snapshot.Detail = "TCP 端口可达"
		return snapshot
	}

	metrics, detail, err := s.collectServerMetrics(ctx, asset)
	if err != nil {
		snapshot.Status = healthModel.HealthStatusWarning
		snapshot.Detail = fmt.Sprintf("TCP 可达，但 SSH 指标采集失败: %v", err)
		return snapshot
	}

	mergeMetrics(snapshot.Metrics, metrics)
	snapshot.Status = healthModel.HealthStatusHealthy
	snapshot.CheckType = "ssh_metrics"
	if detail == "" {
		detail = "TCP 与 SSH 指标采集均正常"
	}
	snapshot.Detail = detail
	return snapshot
}

func (s *HealthService) resolveTarget(asset *assetModel.Asset) (*connector.Target, error) {
	var credential *connector.Credential
	if asset.CredentialID != nil {
		secret, err := s.credSvc.RevealSecret(*asset.CredentialID)
		if err != nil {
			return nil, fmt.Errorf("解密资产凭据失败: %w", err)
		}
		if asset.Credential == nil {
			return nil, fmt.Errorf("资产凭据加载失败")
		}
		credential = &connector.Credential{
			Type:     asset.Credential.Type,
			Username: asset.Credential.Username,
			Secret:   secret,
		}
	}
	return &connector.Target{
		AssetID:    asset.ID,
		AssetName:  asset.Name,
		PluginType: asset.PluginType,
		ExtConfig:  asset.ExtConfig,
		Credential: credential,
	}, nil
}

func determineCheckType(asset *assetModel.Asset) string {
	switch asset.Category {
	case plugin.CategoryDatabase, plugin.CategoryCache, plugin.CategoryMQ:
		return "connector_ping"
	case plugin.CategoryServer:
		if supportsSSHMetrics(asset) {
			return "ssh_metrics"
		}
		return "tcp_port"
	default:
		return "tcp_port"
	}
}

func normalizePort(asset *assetModel.Asset) int {
	port := asset.ExtConfig.GetInt("port")
	if port > 0 {
		return port
	}
	switch asset.PluginType {
	case "mysql":
		return 3306
	case "postgresql":
		return 5432
	case "redis":
		return 6379
	case "rabbitmq":
		return 5672
	case "kafka":
		return 9092
	case "rocketmq":
		return 9876
	case "windows_server":
		return 3389
	case "linux_server":
		return 22
	default:
		switch asset.Category {
		case plugin.CategoryDatabase:
			return 3306
		case plugin.CategoryCache:
			return 6379
		default:
			return 80
		}
	}
}

func (s *HealthService) checkInterval() time.Duration {
	cfg := s.currentConfig()
	if cfg.CheckInterval <= 0 {
		return 60 * time.Second
	}
	return time.Duration(cfg.CheckInterval) * time.Second
}

func (s *HealthService) checkTimeout() time.Duration {
	cfg := s.currentConfig()
	if cfg.Timeout <= 0 {
		return 10 * time.Second
	}
	return time.Duration(cfg.Timeout) * time.Second
}

func (s *HealthService) currentConfig() configModel.HealthSection {
	s.cfgMu.RLock()
	defer s.cfgMu.RUnlock()
	return s.cfg
}

func tcpCheck(ctx context.Context, host string, port int) (int64, error) {
	start := time.Now()
	dialer := net.Dialer{}
	conn, err := dialer.DialContext(ctx, "tcp", fmt.Sprintf("%s:%d", host, port))
	if err != nil {
		return 0, err
	}
	_ = conn.Close()
	return time.Since(start).Milliseconds(), nil
}

func supportsSSHMetrics(asset *assetModel.Asset) bool {
	if asset == nil || asset.Category != plugin.CategoryServer {
		return false
	}
	if asset.PluginType == "windows_server" {
		return false
	}
	return asset.CredentialID != nil
}

func mergeMetrics(dst healthModel.Metrics, src map[string]any) {
	if dst == nil || src == nil {
		return
	}
	for key, value := range src {
		dst[key] = value
	}
}

func mapAssetStatus(status healthModel.HealthStatus) assetModel.AssetStatus {
	switch status {
	case healthModel.HealthStatusHealthy:
		return assetModel.AssetStatusOnline
	case healthModel.HealthStatusWarning:
		return assetModel.AssetStatusWarning
	case healthModel.HealthStatusCritical, healthModel.HealthStatusUnreachable:
		return assetModel.AssetStatusOffline
	default:
		return assetModel.AssetStatusUnknown
	}
}

func (s *HealthService) recordAssetAudit(asset *assetModel.Asset, action string, success bool, detail string, request any, result any) {
	if asset == nil {
		return
	}
	s.recordAudit(auditSvc.RecordInput{
		Module:       "health",
		Action:       action,
		ResourceType: "asset",
		ResourceID:   uintPtr(asset.ID),
		ResourceName: asset.Name,
		PluginType:   asset.PluginType,
		Success:      success,
		Detail:       detail,
		Request: map[string]any{
			"asset_id": asset.ID,
			"category": asset.Category,
			"request":  request,
		},
		Result: result,
	})
}

func (s *HealthService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}

func healthAuditResult(snapshot *healthModel.HealthSnapshot) map[string]any {
	if snapshot == nil {
		return nil
	}
	return map[string]any{
		"status":      snapshot.Status,
		"check_type":  snapshot.CheckType,
		"latency_ms":  snapshot.LatencyMS,
		"checked_at":  snapshot.CheckedAt,
		"detail":      snapshot.Detail,
		"metric_keys": metricKeys(snapshot.Metrics),
	}
}

func metricKeys(metrics healthModel.Metrics) []string {
	keys := make([]string, 0, len(metrics))
	for key := range metrics {
		keys = append(keys, key)
	}
	return keys
}

func batchAuditAction(trigger string) string {
	if trigger == "scheduled" {
		return "auto_check_health"
	}
	return "check_health_batch"
}

func normalizeCheckTrigger(trigger string) string {
	if trigger == "scheduled" {
		return trigger
	}
	return "manual"
}

func uintPtr(value uint) *uint {
	return &value
}
