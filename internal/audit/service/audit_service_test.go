package service

import (
	"testing"
	"time"

	auditModel "EnvPilot/internal/audit/model"
	auditRepo "EnvPilot/internal/audit/repository"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAuditServiceCleanupNowRecordsManualAction(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:audit_service_cleanup?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&auditModel.AuditLog{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	repo := auditRepo.NewAuditRepo(db)
	svc := NewAuditService(repo)

	oldLog := &auditModel.AuditLog{
		Module:       "asset",
		Action:       "update",
		ResourceType: "asset",
		ResourceName: "legacy-entry",
		Success:      true,
		CreatedAt:    time.Now().AddDate(0, 0, -120),
	}
	if err := db.Create(oldLog).Error; err != nil {
		t.Fatalf("create old audit log: %v", err)
	}

	result, err := svc.CleanupNow()
	if err != nil {
		t.Fatalf("cleanup now: %v", err)
	}
	if result.DeletedTotal != 1 {
		t.Fatalf("expected deleted total 1, got %d", result.DeletedTotal)
	}
	if !result.Recorded {
		t.Fatal("expected cleanup action to be recorded")
	}
	if result.TotalAfter != 1 {
		t.Fatalf("expected total after 1, got %d", result.TotalAfter)
	}

	var logs []auditModel.AuditLog
	if err := db.Order("created_at desc").Find(&logs).Error; err != nil {
		t.Fatalf("query logs: %v", err)
	}
	if len(logs) != 1 {
		t.Fatalf("expected 1 remaining log, got %d", len(logs))
	}
	if logs[0].Module != "audit" || logs[0].Action != "cleanup_logs" {
		t.Fatalf("expected cleanup audit log, got %+v", logs[0])
	}
}
