package service

import (
	"errors"
	"fmt"
	"net"
	"sort"
	"strings"
	"time"
	"unicode"

	assetModel "EnvPilot/internal/asset/model"
	assetRepo "EnvPilot/internal/asset/repository"
	auditSvc "EnvPilot/internal/audit/service"
	"EnvPilot/internal/dns/model"
	"EnvPilot/internal/dns/repository"
	"EnvPilot/pkg/logger"

	mdns "github.com/miekg/dns"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type CreateDNSRecordRequest struct {
	EnvironmentID uint             `json:"environment_id"`
	AssetID       *uint            `json:"asset_id"`
	Domain        string           `json:"domain"`
	RecordType    model.RecordType `json:"record_type"`
	Value         string           `json:"value"`
	TTL           int              `json:"ttl"`
	Enabled       bool             `json:"enabled"`
}

type UpdateDNSRecordRequest struct {
	ID         uint             `json:"id"`
	AssetID    *uint            `json:"asset_id"`
	Domain     string           `json:"domain"`
	RecordType model.RecordType `json:"record_type"`
	Value      string           `json:"value"`
	TTL        int              `json:"ttl"`
	Enabled    bool             `json:"enabled"`
}

type ListDNSRecordRequest struct {
	EnvironmentID uint
	Keyword       string
	Enabled       *bool
}

type ListQueryLogsRequest struct {
	EnvironmentID uint
	Keyword       string
	Source        string
	Limit         int
	Offset        int
}

type ListQueryLogsResult struct {
	Items []model.DNSQueryLog `json:"items"`
	Total int64               `json:"total"`
}

type QueryLogInput struct {
	EnvironmentID *uint
	Domain        string
	QuestionType  string
	ResponseCode  string
	AnswerSummary string
	Source        string
	HitLocal      bool
	UpstreamUsed  bool
	ClientIP      string
	DurationMs    int64
}

type LocalResolveResult struct {
	Found         bool
	Domain        string
	EnvironmentID *uint
	Answers       []mdns.RR
	AnswerSummary string
	Source        string
}

type DNSService struct {
	repo         *repository.DNSRepo
	queryLogRepo *repository.DNSQueryLogRepo
	envRepo      *assetRepo.EnvironmentRepo
	astRepo      *assetRepo.AssetRepo
	runtime      *ServerRuntime
	audit        *auditSvc.AuditService
	log          *zap.Logger
}

func NewDNSService(repo *repository.DNSRepo, queryLogRepo *repository.DNSQueryLogRepo, envRepo *assetRepo.EnvironmentRepo, astRepo *assetRepo.AssetRepo, audit *auditSvc.AuditService) *DNSService {
	return &DNSService{
		repo:         repo,
		queryLogRepo: queryLogRepo,
		envRepo:      envRepo,
		astRepo:      astRepo,
		audit:        audit,
		log:          logger.Named("dns"),
	}
}

func (s *DNSService) AttachRuntime(runtime *ServerRuntime) {
	s.runtime = runtime
}

func (s *DNSService) Create(req CreateDNSRecordRequest) (*model.DNSRecord, error) {
	if _, err := s.envRepo.FindByID(req.EnvironmentID); err != nil {
		return nil, fmt.Errorf("环境不存在 [id=%d]", req.EnvironmentID)
	}

	record := &model.DNSRecord{
		EnvironmentID: req.EnvironmentID,
		AssetID:       req.AssetID,
		Domain:        req.Domain,
		RecordType:    req.RecordType,
		Value:         req.Value,
		TTL:           req.TTL,
		Enabled:       req.Enabled,
	}
	if err := s.fillAndValidate(record, 0); err != nil {
		return nil, err
	}
	if err := s.repo.Create(record); err != nil {
		return nil, fmt.Errorf("创建 DNS 记录失败: %w", err)
	}
	created, err := s.repo.FindByID(record.ID)
	if err != nil {
		return nil, fmt.Errorf("查询新建 DNS 记录失败: %w", err)
	}
	s.syncResolvedValue(created)
	s.log.Info("创建 DNS 记录", zap.Uint("id", created.ID), zap.String("domain", created.Domain), zap.String("type", string(created.RecordType)))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "dns",
		Action:       "create_dns_record",
		ResourceType: "dns_record",
		ResourceID:   &created.ID,
		ResourceName: created.Domain,
		Success:      true,
		Detail:       "创建 DNS 记录",
		Request: map[string]any{
			"environment_id": created.EnvironmentID,
			"record_type":    created.RecordType,
			"asset_id":       created.AssetID,
		},
	})
	return created, nil
}

func (s *DNSService) Update(req UpdateDNSRecordRequest) (*model.DNSRecord, error) {
	record, err := s.repo.FindByID(req.ID)
	if err != nil {
		return nil, fmt.Errorf("DNS 记录不存在 [id=%d]", req.ID)
	}

	record.AssetID = req.AssetID
	record.Domain = req.Domain
	record.RecordType = req.RecordType
	record.Value = req.Value
	record.TTL = req.TTL
	record.Enabled = req.Enabled

	if err := s.fillAndValidate(record, req.ID); err != nil {
		return nil, err
	}
	if err := s.repo.Update(record); err != nil {
		return nil, fmt.Errorf("更新 DNS 记录失败: %w", err)
	}
	updated, err := s.repo.FindByID(record.ID)
	if err != nil {
		return nil, fmt.Errorf("查询更新后的 DNS 记录失败: %w", err)
	}
	s.syncResolvedValue(updated)
	s.log.Info("更新 DNS 记录", zap.Uint("id", updated.ID), zap.String("domain", updated.Domain))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "dns",
		Action:       "update_dns_record",
		ResourceType: "dns_record",
		ResourceID:   &updated.ID,
		ResourceName: updated.Domain,
		Success:      true,
		Detail:       "更新 DNS 记录",
		Request: map[string]any{
			"record_type": updated.RecordType,
			"asset_id":    updated.AssetID,
			"enabled":     updated.Enabled,
		},
	})
	return updated, nil
}

func (s *DNSService) Delete(id uint) error {
	record, err := s.repo.FindByID(id)
	if err != nil {
		return fmt.Errorf("DNS 记录不存在 [id=%d]", id)
	}
	if err := s.repo.Delete(id); err != nil {
		return fmt.Errorf("删除 DNS 记录失败: %w", err)
	}
	s.log.Info("删除 DNS 记录", zap.Uint("id", id), zap.String("domain", record.Domain))
	s.recordAudit(auditSvc.RecordInput{
		Module:       "dns",
		Action:       "delete_dns_record",
		ResourceType: "dns_record",
		ResourceID:   &record.ID,
		ResourceName: record.Domain,
		Success:      true,
		Detail:       "删除 DNS 记录",
	})
	return nil
}

func (s *DNSService) SetEnabled(id uint, enabled bool) (*model.DNSRecord, error) {
	record, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("DNS 记录不存在 [id=%d]", id)
	}
	record.Enabled = enabled
	if err := s.repo.Update(record); err != nil {
		return nil, fmt.Errorf("更新 DNS 记录状态失败: %w", err)
	}
	updated, err := s.repo.FindByID(id)
	if err != nil {
		return nil, fmt.Errorf("查询 DNS 记录失败: %w", err)
	}
	s.syncResolvedValue(updated)
	s.recordAudit(auditSvc.RecordInput{
		Module:       "dns",
		Action:       "toggle_dns_record",
		ResourceType: "dns_record",
		ResourceID:   &updated.ID,
		ResourceName: updated.Domain,
		Success:      true,
		Detail:       "更新 DNS 记录启用状态",
		Request: map[string]any{
			"enabled": enabled,
		},
	})
	return updated, nil
}

func (s *DNSService) GetByID(id uint) (*model.DNSRecord, error) {
	record, err := s.repo.FindByID(id)
	if err != nil {
		return nil, err
	}
	s.syncResolvedValue(record)
	return record, nil
}

func (s *DNSService) GetByAssetID(assetID uint) (*model.DNSRecord, error) {
	record, err := s.repo.FindByAssetID(assetID)
	if err != nil {
		return nil, err
	}
	s.syncResolvedValue(record)
	return record, nil
}

func (s *DNSService) GetStatus() RuntimeStatus {
	if s.runtime == nil {
		return RuntimeStatus{Enabled: false, Running: false, ListenAddr: "", Upstream: "", DefaultTTL: 0}
	}
	return s.runtime.Status()
}

func (s *DNSService) StopRuntime() error {
	if s.runtime == nil {
		return nil
	}
	return s.runtime.Stop()
}

func (s *DNSService) List(req ListDNSRecordRequest) ([]model.DNSRecord, error) {
	list, err := s.repo.List(repository.DNSFilter(req))
	if err != nil {
		return nil, fmt.Errorf("查询 DNS 记录失败: %w", err)
	}
	if list == nil {
		list = []model.DNSRecord{}
	}
	for i := range list {
		s.syncResolvedValue(&list[i])
	}
	return list, nil
}

func (s *DNSService) DeleteByAssetID(assetID uint) error {
	record, err := s.repo.FindByAssetID(assetID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return fmt.Errorf("查询资产关联 DNS 记录失败: %w", err)
	}
	return s.Delete(record.ID)
}

func (s *DNSService) RecordQueryLog(input QueryLogInput) error {
	if s.queryLogRepo == nil {
		return nil
	}
	return s.queryLogRepo.Create(&model.DNSQueryLog{
		EnvironmentID: input.EnvironmentID,
		Domain:        normalizeDomain(input.Domain),
		QuestionType:  input.QuestionType,
		ResponseCode:  input.ResponseCode,
		AnswerSummary: input.AnswerSummary,
		Source:        input.Source,
		HitLocal:      input.HitLocal,
		UpstreamUsed:  input.UpstreamUsed,
		ClientIP:      input.ClientIP,
		DurationMs:    input.DurationMs,
		QueriedAt:     timeNow(),
	})
}

func (s *DNSService) RecordQueryLogBestEffort(input QueryLogInput) {
	if err := s.RecordQueryLog(input); err != nil {
		s.log.Warn("记录 DNS 查询日志失败", zap.Error(err), zap.String("domain", input.Domain))
	}
}

func (s *DNSService) ResolveLocal(questionName string, qType uint16, defaultTTL uint32) (*LocalResolveResult, error) {
	domain := normalizeDomain(questionName)
	matchedEnv, err := s.matchEnvironmentFromDomain(domain)
	if err != nil {
		return nil, err
	}

	var records []model.DNSRecord
	if matchedEnv != nil {
		records, err = s.repo.ListEnabledByEnvironmentAndDomain(matchedEnv.ID, domain)
	} else {
		records, err = s.repo.ListEnabledByDomain(domain)
	}
	if err != nil {
		return nil, fmt.Errorf("查询本地 DNS 记录失败: %w", err)
	}
	if len(records) == 0 {
		return &LocalResolveResult{Found: false, Domain: domain, EnvironmentID: envPtr(matchedEnv), Source: missSource(matchedEnv)}, nil
	}
	if matchedEnv == nil && hasCrossEnvConflict(records) {
		return &LocalResolveResult{Found: false, Domain: domain, Source: "local_conflict"}, nil
	}

	answers := make([]mdns.RR, 0, len(records))
	for i := range records {
		s.syncResolvedValue(&records[i])
		rr, ok, err := buildRR(records[i], domain, qType, defaultTTL)
		if err != nil {
			return nil, err
		}
		if ok {
			answers = append(answers, rr)
		}
	}
	if len(answers) == 0 {
		return &LocalResolveResult{Found: false, Domain: domain, EnvironmentID: envPtr(matchedEnv), Source: missSource(matchedEnv)}, nil
	}
	sort.SliceStable(answers, func(i, j int) bool { return answers[i].Header().Rrtype < answers[j].Header().Rrtype })
	return &LocalResolveResult{
		Found:         true,
		Domain:        domain,
		EnvironmentID: envPtr(matchedEnv),
		Answers:       answers,
		AnswerSummary: summarizeLocalAnswers(answers),
		Source:        "local",
	}, nil
}

func (s *DNSService) fillAndValidate(record *model.DNSRecord, excludeID uint) error {
	record.Normalize()
	if record.Domain == "" {
		return fmt.Errorf("域名不能为空")
	}
	if record.RecordType != model.RecordTypeA && record.RecordType != model.RecordTypeCNAME {
		return fmt.Errorf("仅支持 A 或 CNAME 记录")
	}
	if record.TTL < 30 {
		return fmt.Errorf("TTL 不能小于 30 秒")
	}
	if record.TTL > 86400 {
		return fmt.Errorf("TTL 不能大于 86400 秒")
	}
	if exists, err := s.repo.ExistsByUniqueKey(record.EnvironmentID, record.Domain, record.RecordType, excludeID); err != nil {
		return fmt.Errorf("检查 DNS 记录唯一性失败: %w", err)
	} else if exists {
		return fmt.Errorf("当前环境下相同域名和记录类型已存在")
	}

	if record.AssetID != nil {
		asset, err := s.astRepo.FindByID(*record.AssetID)
		if err != nil {
			return fmt.Errorf("关联资产不存在 [id=%d]", *record.AssetID)
		}
		if asset.EnvironmentID != record.EnvironmentID {
			return fmt.Errorf("关联资产与 DNS 记录环境不一致")
		}
		if record.RecordType != model.RecordTypeA {
			return fmt.Errorf("绑定资产时仅支持 A 记录")
		}
		host := asset.ExtConfig.GetString("host")
		if host == "" {
			return fmt.Errorf("关联资产未配置 host，无法生成 A 记录")
		}
		record.Value = host
		return nil
	}

	if record.Value == "" {
		return fmt.Errorf("记录值不能为空")
	}
	return nil
}

func (s *DNSService) syncResolvedValue(record *model.DNSRecord) {
	if record == nil || record.AssetID == nil {
		return
	}
	if record.Asset != nil {
		if host := record.Asset.ExtConfig.GetString("host"); host != "" {
			record.Value = host
		}
	}
}

func (s *DNSService) recordAudit(input auditSvc.RecordInput) {
	if s.audit == nil {
		return
	}
	s.audit.RecordBestEffort(input)
}

func (s *DNSService) ListQueryLogs(req ListQueryLogsRequest) (*ListQueryLogsResult, error) {
	if s.queryLogRepo == nil {
		return &ListQueryLogsResult{Items: []model.DNSQueryLog{}, Total: 0}, nil
	}
	items, total, err := s.queryLogRepo.List(repository.DNSQueryLogFilter{
		EnvironmentID: req.EnvironmentID,
		Keyword:       req.Keyword,
		Source:        req.Source,
		Limit:         req.Limit,
		Offset:        req.Offset,
	})
	if err != nil {
		return nil, fmt.Errorf("查询 DNS 日志失败: %w", err)
	}
	if items == nil {
		items = []model.DNSQueryLog{}
	}
	return &ListQueryLogsResult{Items: items, Total: total}, nil
}

func (s *DNSService) matchEnvironmentFromDomain(domain string) (*assetModel.Environment, error) {
	envs, err := s.envRepo.ListAll()
	if err != nil {
		return nil, fmt.Errorf("读取环境列表失败: %w", err)
	}
	var matched *assetModel.Environment
	maxLen := -1
	for i := range envs {
		slug := slugDomainLabel(envs[i].Name)
		if slug == "" {
			continue
		}
		suffix := "." + slug + ".local"
		if domain == slug+".local" || strings.HasSuffix(domain, suffix) {
			if len(suffix) > maxLen {
				candidate := envs[i]
				matched = &candidate
				maxLen = len(suffix)
			}
		}
	}
	return matched, nil
}

func envPtr(env *assetModel.Environment) *uint {
	if env == nil {
		return nil
	}
	id := env.ID
	return &id
}

func hasCrossEnvConflict(records []model.DNSRecord) bool {
	if len(records) <= 1 {
		return false
	}
	first := records[0].EnvironmentID
	for _, record := range records[1:] {
		if record.EnvironmentID != first {
			return true
		}
	}
	return false
}

func missSource(env *assetModel.Environment) string {
	if env == nil {
		return "local_miss"
	}
	return "local_scoped_miss"
}

func buildRR(record model.DNSRecord, domain string, qType uint16, defaultTTL uint32) (mdns.RR, bool, error) {
	ttl := uint32(record.TTL)
	if ttl == 0 {
		ttl = defaultTTL
	}
	host := mdns.Fqdn(domain)
	value := record.Value
	if record.RecordType == model.RecordTypeCNAME || net.ParseIP(value) == nil {
		if qType != mdns.TypeA && qType != mdns.TypeCNAME && qType != mdns.TypeANY {
			return nil, false, nil
		}
		rr, err := mdns.NewRR(fmt.Sprintf("%s %d IN CNAME %s", host, ttl, mdns.Fqdn(value)))
		return rr, err == nil, err
	}
	ip := net.ParseIP(value)
	if ip == nil {
		return nil, false, fmt.Errorf("DNS 记录值不是有效 IP: %s", value)
	}
	if ipv4 := ip.To4(); ipv4 != nil {
		if qType != mdns.TypeA && qType != mdns.TypeANY {
			return nil, false, nil
		}
		rr, err := mdns.NewRR(fmt.Sprintf("%s %d IN A %s", host, ttl, ipv4.String()))
		return rr, err == nil, err
	}
	if qType != mdns.TypeAAAA && qType != mdns.TypeANY {
		return nil, false, nil
	}
	rr, err := mdns.NewRR(fmt.Sprintf("%s %d IN AAAA %s", host, ttl, ip.String()))
	return rr, err == nil, err
}

func summarizeLocalAnswers(answers []mdns.RR) string {
	parts := make([]string, 0, len(answers))
	for _, answer := range answers {
		parts = append(parts, answer.String())
	}
	return strings.Join(parts, "\n")
}

func normalizeDomain(domain string) string {
	domain = strings.TrimSpace(strings.ToLower(domain))
	return strings.TrimSuffix(domain, ".")
}

func slugDomainLabel(input string) string {
	input = strings.ToLower(strings.TrimSpace(input))
	if input == "" {
		return ""
	}
	var builder strings.Builder
	lastHyphen := false
	for _, r := range input {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			builder.WriteRune(r)
			lastHyphen = false
		case r == '-' || r == '_' || unicode.IsSpace(r) || r == '.':
			if builder.Len() > 0 && !lastHyphen {
				builder.WriteRune('-')
				lastHyphen = true
			}
		}
	}
	return strings.Trim(builder.String(), "-")
}

var timeNow = func() time.Time { return time.Now() }
