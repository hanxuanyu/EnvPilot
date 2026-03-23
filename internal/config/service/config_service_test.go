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
  driver: sqlite
  sqlite:
    filename: envpilot.db
  pool:
    max_idle_conns: 5
    max_open_conns: 20
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

func TestParseConfigBytesMigratesLegacyDatabaseFields(t *testing.T) {
	cfg, err := parseConfigBytes([]byte(`app:
  name: EnvPilot
  data_dir: ./data
  log_dir: ./logs
database:
  driver: mysql
  host: 127.0.0.1
  port: 3306
  username: root
  password: secret
  dbname: envpilot
  params: charset=utf8mb4&parseTime=True&loc=UTC
  filename: legacy.db
  max_idle_conns: 7
  max_open_conns: 21
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
	if cfg.Database.Driver != "mysql" {
		t.Fatalf("expected mysql driver, got %s", cfg.Database.Driver)
	}
	if cfg.Database.MySQL.Host != "127.0.0.1" {
		t.Fatalf("expected migrated mysql host, got %s", cfg.Database.MySQL.Host)
	}
	if cfg.Database.MySQL.DBName != "envpilot" {
		t.Fatalf("expected migrated mysql dbname, got %s", cfg.Database.MySQL.DBName)
	}
	if cfg.Database.SQLite.Filename != "legacy.db" {
		t.Fatalf("expected migrated sqlite filename, got %s", cfg.Database.SQLite.Filename)
	}
	if cfg.Database.Pool.MaxIdleConns != 7 || cfg.Database.Pool.MaxOpenConns != 21 {
		t.Fatalf("expected migrated pool config, got %+v", cfg.Database.Pool)
	}
	if cfg.Database.LegacyHost != "" || cfg.Database.LegacyFilename != "" {
		t.Fatal("expected legacy database fields to be cleared after normalization")
	}
}
