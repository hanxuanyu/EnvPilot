package service

import (
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	configModel "EnvPilot/internal/config/model"
	"EnvPilot/pkg/logger"

	mdns "github.com/miekg/dns"
	"go.uber.org/zap"
)

type RuntimeStatus struct {
	Enabled    bool   `json:"enabled"`
	Running    bool   `json:"running"`
	ListenAddr string `json:"listen_addr"`
	Upstream   string `json:"upstream"`
	DefaultTTL uint32 `json:"default_ttl"`
}

type ServerRuntime struct {
	resolver   *DNSService
	log        *zap.Logger
	cfg        configModel.DNSSection
	udpServer  *mdns.Server
	tcpServer  *mdns.Server
	running    bool
	statusLock sync.RWMutex
}

func NewServerRuntime(cfg configModel.DNSSection, resolver *DNSService) *ServerRuntime {
	return &ServerRuntime{
		resolver: resolver,
		cfg:      cfg,
		log:      logger.Named("dns_runtime"),
	}
}

func (r *ServerRuntime) Start() error {
	status := r.Status()
	if !status.Enabled {
		return nil
	}
	r.statusLock.RLock()
	cfg := r.cfg
	r.statusLock.RUnlock()
	handler := mdns.HandlerFunc(r.handleDNS)
	udpConn, err := net.ListenPacket("udp", cfg.ListenAddr)
	if err != nil {
		return fmt.Errorf("启动 UDP DNS 服务失败: %w", err)
	}
	tcpListener, err := net.Listen("tcp", cfg.ListenAddr)
	if err != nil {
		_ = udpConn.Close()
		return fmt.Errorf("启动 TCP DNS 服务失败: %w", err)
	}
	udp := &mdns.Server{PacketConn: udpConn, Net: "udp", Handler: handler}
	tcp := &mdns.Server{Listener: tcpListener, Net: "tcp", Handler: handler}

	go func() {
		if err := udp.ActivateAndServe(); err != nil {
			r.log.Error("UDP DNS 服务异常退出", zap.Error(err))
			r.setRunning(false)
		}
	}()
	go func() {
		if err := tcp.ActivateAndServe(); err != nil {
			r.log.Error("TCP DNS 服务异常退出", zap.Error(err))
			r.setRunning(false)
		}
	}()

	r.udpServer = udp
	r.tcpServer = tcp
	r.setRunning(true)
	r.log.Info("DNS 服务已启动", zap.String("listen", cfg.ListenAddr), zap.String("upstream", cfg.Upstream))
	return nil
}

func (r *ServerRuntime) Stop() error {
	var stopErr error
	if r.udpServer != nil {
		if err := r.udpServer.Shutdown(); err != nil {
			stopErr = err
		}
	}
	if r.tcpServer != nil {
		if err := r.tcpServer.Shutdown(); err != nil && stopErr == nil {
			stopErr = err
		}
	}
	r.setRunning(false)
	r.udpServer = nil
	r.tcpServer = nil
	return stopErr
}

func (r *ServerRuntime) UpdateConfig(cfg configModel.DNSSection) error {
	status := r.Status()
	if status.Running || status.Enabled {
		if err := r.Stop(); err != nil {
			return err
		}
	}
	r.statusLock.Lock()
	r.cfg = cfg
	r.statusLock.Unlock()
	if !cfg.Enabled {
		r.log.Info("DNS 服务配置已更新，当前为停用状态")
		return nil
	}
	if err := r.Start(); err != nil {
		return err
	}
	r.log.Info("DNS 服务配置已热更新", zap.String("listen", cfg.ListenAddr), zap.String("upstream", cfg.Upstream))
	return nil
}

func (r *ServerRuntime) Status() RuntimeStatus {
	r.statusLock.RLock()
	defer r.statusLock.RUnlock()
	return RuntimeStatus{
		Enabled:    r.cfg.Enabled,
		Running:    r.running,
		ListenAddr: r.cfg.ListenAddr,
		Upstream:   r.cfg.Upstream,
		DefaultTTL: r.cfg.DefaultTTL,
	}
}

func (r *ServerRuntime) setRunning(running bool) {
	r.statusLock.Lock()
	defer r.statusLock.Unlock()
	r.running = running
}

func (r *ServerRuntime) handleDNS(w mdns.ResponseWriter, req *mdns.Msg) {
	r.statusLock.RLock()
	cfg := r.cfg
	r.statusLock.RUnlock()

	resp := new(mdns.Msg)
	resp.SetReply(req)
	resp.Authoritative = true

	if len(req.Question) == 0 {
		resp.Rcode = mdns.RcodeFormatError
		_ = w.WriteMsg(resp)
		return
	}

	question := req.Question[0]
	clientIP := remoteIP(w.RemoteAddr())
	startedAt := time.Now()

	localResult, err := r.resolver.ResolveLocal(question.Name, question.Qtype, cfg.DefaultTTL)
	if err == nil && localResult.Found {
		resp.Answer = localResult.Answers
		resp.Rcode = mdns.RcodeSuccess
		_ = w.WriteMsg(resp)
		r.resolver.RecordQueryLogBestEffort(QueryLogInput{
			EnvironmentID: localResult.EnvironmentID,
			Domain:        localResult.Domain,
			QuestionType:  mdns.TypeToString[question.Qtype],
			ResponseCode:  mdns.RcodeToString[resp.Rcode],
			AnswerSummary: localResult.AnswerSummary,
			Source:        localResult.Source,
			HitLocal:      true,
			UpstreamUsed:  false,
			ClientIP:      clientIP,
			DurationMs:    time.Since(startedAt).Milliseconds(),
		})
		return
	}

	upstreamResp, upstreamErr := r.forwardToUpstream(req, cfg.Upstream)
	if upstreamErr != nil {
		resp.Rcode = mdns.RcodeServerFailure
		_ = w.WriteMsg(resp)
		r.resolver.RecordQueryLogBestEffort(QueryLogInput{
			EnvironmentID: envIDFromLocalResult(localResult),
			Domain:        normalizeRuntimeDomain(question.Name),
			QuestionType:  mdns.TypeToString[question.Qtype],
			ResponseCode:  mdns.RcodeToString[resp.Rcode],
			AnswerSummary: upstreamErr.Error(),
			Source:        sourceFromMiss(localResult, "upstream_error"),
			HitLocal:      false,
			UpstreamUsed:  true,
			ClientIP:      clientIP,
			DurationMs:    time.Since(startedAt).Milliseconds(),
		})
		return
	}

	_ = w.WriteMsg(upstreamResp)
	r.resolver.RecordQueryLogBestEffort(QueryLogInput{
		EnvironmentID: envIDFromLocalResult(localResult),
		Domain:        normalizeRuntimeDomain(question.Name),
		QuestionType:  mdns.TypeToString[question.Qtype],
		ResponseCode:  mdns.RcodeToString[upstreamResp.Rcode],
		AnswerSummary: summarizeAnswers(upstreamResp.Answer),
		Source:        sourceFromMiss(localResult, "upstream"),
		HitLocal:      false,
		UpstreamUsed:  true,
		ClientIP:      clientIP,
		DurationMs:    time.Since(startedAt).Milliseconds(),
	})
}

func (r *ServerRuntime) forwardToUpstream(req *mdns.Msg, upstream string) (*mdns.Msg, error) {
	client := &mdns.Client{Net: "udp", Timeout: 5 * time.Second}
	resp, _, err := client.Exchange(req, upstream)
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func remoteIP(addr net.Addr) string {
	if addr == nil {
		return ""
	}
	host, _, err := net.SplitHostPort(addr.String())
	if err == nil {
		return host
	}
	return addr.String()
}

func summarizeAnswers(answer []mdns.RR) string {
	if len(answer) == 0 {
		return ""
	}
	items := make([]string, 0, len(answer))
	for _, rr := range answer {
		items = append(items, rr.String())
	}
	return strings.Join(items, "\n")
}

func normalizeRuntimeDomain(domain string) string {
	domain = strings.TrimSpace(strings.ToLower(domain))
	return strings.TrimSuffix(domain, ".")
}

func envIDFromLocalResult(result *LocalResolveResult) *uint {
	if result == nil {
		return nil
	}
	return result.EnvironmentID
}

func sourceFromMiss(result *LocalResolveResult, fallback string) string {
	if result == nil || result.Source == "" {
		return fallback
	}
	if result.Found {
		return result.Source
	}
	return fmt.Sprintf("%s+%s", result.Source, fallback)
}
