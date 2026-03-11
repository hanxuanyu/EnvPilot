package service

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	assetModel "EnvPilot/internal/asset/model"
	healthModel "EnvPilot/internal/health/model"

	gossh "golang.org/x/crypto/ssh"
	"go.uber.org/zap"
)

func (s *HealthService) collectServerMetrics(ctx context.Context, asset *assetModel.Asset) (healthModel.Metrics, string, error) {
	startedAt := time.Now()
	client, err := s.pool.GetClient(asset.ID)
	if err != nil {
		s.log.Warn("SSH 指标采集失败：获取连接失败",
			zap.Uint("asset_id", asset.ID),
			zap.String("asset_name", asset.Name),
			zap.String("plugin_type", asset.PluginType),
			zap.Error(err),
		)
		return nil, "", err
	}
	result := make(healthModel.Metrics)
	result["ssh_metrics"] = true
	failures := make([]string, 0, 6)
	successCount := 0

	if value, err := runSSHCommand(ctx, client, "(hostname 2>/dev/null || uname -n 2>/dev/null || echo unknown) 2>/dev/null || true"); err == nil {
		if hostName := firstMeaningfulLine(value); hostName != "" {
			result["host_name"] = hostName
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if value, err := runSSHCommand(ctx, client, "(uname -sr 2>/dev/null || echo unknown) 2>/dev/null || true"); err == nil {
		if kernel := firstMeaningfulLine(value); kernel != "" {
			result["kernel"] = kernel
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if value, err := runSSHCommand(ctx, client, "(getconf _NPROCESSORS_ONLN 2>/dev/null || nproc 2>/dev/null || grep -c '^processor' /proc/cpuinfo 2>/dev/null || true)"); err == nil {
		if cpuCores := parseInt64(firstMeaningfulLine(value)); cpuCores > 0 {
			result["cpu_cores"] = cpuCores
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if value, err := runSSHCommand(ctx, client, "(cat /proc/uptime 2>/dev/null || uptime 2>/dev/null || true)"); err == nil {
		if uptime := parseUptimeOutput(value); uptime != "" {
			result["uptime"] = uptime
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if value, err := runSSHCommand(ctx, client, "(cat /proc/loadavg 2>/dev/null || uptime 2>/dev/null || true)"); err == nil {
		if loads := parseLoadAverageOutput(value); len(loads) > 0 {
			result["load_average"] = loads
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if value, err := runSSHCommand(ctx, client, "(cat /proc/meminfo 2>/dev/null || free -b 2>/dev/null || true)"); err == nil {
		if memMetrics := parseMemoryMetrics(value); len(memMetrics) > 0 {
			mergeMetrics(result, memMetrics)
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if value, err := runSSHCommand(ctx, client, "(df -Pk / 2>/dev/null || true)"); err == nil {
		if diskMetrics := parseDiskMetrics(value); len(diskMetrics) > 0 {
			mergeMetrics(result, diskMetrics)
			successCount++
		}
	} else {
		failures = append(failures, err.Error())
	}

	if successCount == 0 {
		s.pool.Remove(asset.ID)
		s.log.Warn("SSH 指标采集失败：未采集到有效指标",
			zap.Uint("asset_id", asset.ID),
			zap.String("asset_name", asset.Name),
			zap.String("plugin_type", asset.PluginType),
			zap.Duration("duration", time.Since(startedAt)),
			zap.Strings("failures", failures),
		)
		if len(failures) == 0 {
			return nil, "", fmt.Errorf("SSH 登录成功，但未采集到任何系统指标")
		}
		return nil, "", fmt.Errorf("SSH 登录成功，但指标命令均未返回有效结果: %s", strings.Join(failures, " | "))
	}

	detailParts := make([]string, 0, 3)
	if loadText := formatLoadAverage(result["load_average"]); loadText != "" {
		detailParts = append(detailParts, "负载 "+loadText)
	}
	if loadRatio := formatLoadRatio(result["load_average"], result["cpu_cores"]); loadRatio != "" {
		result["load_ratio_1m"] = loadRatio
	}
	if memUsage := formatUsagePercent(result["mem_used_bytes"], result["mem_total_bytes"]); memUsage != "" {
		result["mem_usage_percent"] = memUsage
		detailParts = append(detailParts, "内存使用 "+memUsage)
	}
	if diskUsage := formatUsagePercent(result["disk_used_bytes"], result["disk_total_bytes"]); diskUsage != "" {
		result["disk_usage_percent"] = diskUsage
		detailParts = append(detailParts, "根分区使用 "+diskUsage)
	}

	detail := "SSH 指标采集完成"
	if len(detailParts) > 0 {
		detail += "：" + strings.Join(detailParts, "，")
	}
	if len(failures) > 0 || time.Since(startedAt) >= slowHealthCheckThreshold {
		fields := []zap.Field{
			zap.Uint("asset_id", asset.ID),
			zap.String("asset_name", asset.Name),
			zap.String("plugin_type", asset.PluginType),
			zap.Int("success_metrics", successCount),
			zap.Int("failed_metrics", len(failures)),
			zap.Duration("duration", time.Since(startedAt)),
		}
		if len(failures) > 0 {
			fields = append(fields, zap.Strings("failures", failures))
		}
		s.log.Info("SSH 指标采集结果", fields...)
	}
	return result, detail, nil
}

func runSSHCommand(ctx context.Context, client *gossh.Client, command string) (string, error) {
	session, err := client.NewSession()
	if err != nil {
		return "", err
	}
	defer session.Close()

	type result struct {
		output []byte
		err    error
	}

	resultCh := make(chan result, 1)
	go func() {
		session.Stdin = strings.NewReader(command + "\n")
		output, runErr := session.CombinedOutput("/bin/sh -s")
		resultCh <- result{output: output, err: runErr}
	}()

	select {
	case <-ctx.Done():
		_ = session.Close()
		return "", ctx.Err()
	case result := <-resultCh:
		if result.err != nil {
			output := strings.TrimSpace(string(result.output))
			if output != "" {
				return "", fmt.Errorf("远程命令执行失败: %w; output=%s", result.err, output)
			}
			return "", fmt.Errorf("远程命令执行失败: %w", result.err)
		}
		return string(result.output), nil
	}
}

func firstMeaningfulLine(output string) string {
	for _, line := range strings.Split(output, "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func parseUptimeOutput(output string) string {
	trimmed := firstMeaningfulLine(output)
	if trimmed == "" {
		return ""
	}
	if fields := strings.Fields(trimmed); len(fields) >= 1 {
		if _, err := strconv.ParseFloat(fields[0], 64); err == nil {
			return fields[0]
		}
	}
	return trimmed
}

func parseLoadAverageOutput(output string) []float64 {
	trimmed := strings.TrimSpace(output)
	if trimmed == "" {
		return nil
	}
	if lines := strings.Split(trimmed, "\n"); len(lines) > 0 {
		fields := strings.Fields(lines[0])
		if len(fields) >= 3 {
			if loads := parseLoadAverageTokens(fields[:3]); len(loads) > 0 {
				return loads
			}
		}
	}
	markerIndex := strings.LastIndex(trimmed, "load average:")
	markerLength := len("load average:")
	if markerIndex < 0 {
		markerIndex = strings.LastIndex(trimmed, "load averages:")
		markerLength = len("load averages:")
	}
	if markerIndex >= 0 {
		segment := strings.TrimSpace(trimmed[markerIndex+markerLength:])
		segment = strings.ReplaceAll(segment, ",", " ")
		if loads := parseLoadAverageTokens(strings.Fields(segment)); len(loads) > 0 {
			return loads
		}
	}
	return nil
}

func parseLoadAverageTokens(tokens []string) []float64 {
	loads := make([]float64, 0, 3)
	for _, token := range tokens {
		token = strings.Trim(token, ",")
		if token == "" {
			continue
		}
		parsed, err := strconv.ParseFloat(token, 64)
		if err != nil {
			break
		}
		loads = append(loads, parsed)
		if len(loads) == 3 {
			break
		}
	}
	return loads
}

func parseMemoryMetrics(output string) healthModel.Metrics {
	result := make(healthModel.Metrics)
	trimmed := strings.TrimSpace(output)
	if trimmed == "" {
		return nil
	}

	if strings.Contains(trimmed, "MemTotal:") {
		var total, available int64
		for _, line := range strings.Split(trimmed, "\n") {
			fields := strings.Fields(line)
			if len(fields) < 2 {
				continue
			}
			switch fields[0] {
			case "MemTotal:":
				total = parseInt64(fields[1]) * 1024
			case "MemAvailable:":
				available = parseInt64(fields[1]) * 1024
			}
		}
		if total > 0 {
			result["mem_total_bytes"] = total
			if available > 0 {
				result["mem_available_bytes"] = available
				result["mem_used_bytes"] = total - available
			}
		}
	}

	if len(result) == 0 {
		for _, line := range strings.Split(trimmed, "\n") {
			fields := strings.Fields(line)
			if len(fields) < 7 || fields[0] != "Mem:" {
				continue
			}
			total := parseInt64(fields[1])
			used := parseInt64(fields[2])
			available := parseInt64(fields[6])
			if total > 0 {
				result["mem_total_bytes"] = total
			}
			if used > 0 {
				result["mem_used_bytes"] = used
			}
			if available > 0 {
				result["mem_available_bytes"] = available
			}
			break
		}
	}

	if len(result) == 0 {
		return nil
	}
	return result
}

func parseDiskMetrics(output string) healthModel.Metrics {
	trimmed := strings.TrimSpace(output)
	if trimmed == "" {
		return nil
	}
	for _, line := range strings.Split(trimmed, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 6 || fields[0] == "Filesystem" {
			continue
		}
		total := parseInt64(fields[1]) * 1024
		used := parseInt64(fields[2]) * 1024
		available := parseInt64(fields[3]) * 1024
		if total <= 0 {
			continue
		}
		return healthModel.Metrics{
			"disk_total_bytes":     total,
			"disk_used_bytes":      used,
			"disk_available_bytes": available,
			"disk_use_percent":     strings.TrimSuffix(fields[4], "%"),
			"disk_mount":           fields[len(fields)-1],
		}
	}
	return nil
}

func parseInt64(value string) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func formatLoadAverage(value any) string {
	loads, ok := value.([]float64)
	if !ok || len(loads) == 0 {
		return ""
	}
	parts := make([]string, 0, len(loads))
	for _, item := range loads {
		parts = append(parts, strconv.FormatFloat(item, 'f', 2, 64))
	}
	return strings.Join(parts, "/")
}

func formatUsagePercent(used any, total any) string {
	usedValue, ok := used.(int64)
	if !ok || usedValue <= 0 {
		return ""
	}
	totalValue, ok := total.(int64)
	if !ok || totalValue <= 0 {
		return ""
	}
	percent := float64(usedValue) * 100 / float64(totalValue)
	return strconv.FormatFloat(percent, 'f', 1, 64) + "%"
}

func formatLoadRatio(load any, cores any) string {
	loadValues, ok := load.([]float64)
	if !ok || len(loadValues) == 0 {
		return ""
	}
	coreCount, ok := cores.(int64)
	if !ok || coreCount <= 0 {
		return ""
	}
	ratio := loadValues[0] * 100 / float64(coreCount)
	return strconv.FormatFloat(ratio, 'f', 0, 64) + "%"
}
