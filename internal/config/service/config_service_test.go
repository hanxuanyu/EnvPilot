package service

import (
	"testing"
)

func TestParseConfigBytesAppliesAuditDefaultsWhenSectionMissing(t *testing.T) {
	cfg, err := parseConfigBytes([]byte(`app:
  name: EnvPilot
  data_dir: ./data
  log_dir: ./logs
log:
  level: info
database:
  filename: envpilot.db
security:
  master_password_enabled: false
dns:
  enabled: false
health:
  check_interval: 60
  timeout: 10
  auto_check: false
`))
	if err != nil {
		t.Fatalf("parse config bytes: %v", err)
	}
	if !cfg.Audit.AutoCleanup {
		t.Fatal("expected audit.auto_cleanup default to be true")
	}
	if cfg.Audit.RetentionDays != 90 {
		t.Fatalf("expected audit.retention_days 90, got %d", cfg.Audit.RetentionDays)
	}
	if cfg.Audit.MaxRecords != 50000 {
		t.Fatalf("expected audit.max_records 50000, got %d", cfg.Audit.MaxRecords)
	}
	if cfg.Audit.CleanupIntervalHours != 24 {
		t.Fatalf("expected audit.cleanup_interval_hours 24, got %d", cfg.Audit.CleanupIntervalHours)
	}
}
