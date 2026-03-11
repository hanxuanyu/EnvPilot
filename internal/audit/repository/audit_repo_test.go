package repository

import (
	"testing"
	"time"

	auditModel "EnvPilot/internal/audit/model"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAuditRepoCleanupDeletesExpiredAndExcessLogs(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:audit_repo_cleanup?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&auditModel.AuditLog{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	repo := NewAuditRepo(db)
	now := time.Now()
	entries := []auditModel.AuditLog{
		{Module: "asset", Action: "create", Success: true, ResourceName: "old-1", CreatedAt: now.AddDate(0, 0, -140)},
		{Module: "asset", Action: "create", Success: true, ResourceName: "old-2", CreatedAt: now.AddDate(0, 0, -120)},
		{Module: "asset", Action: "create", Success: true, ResourceName: "old-3", CreatedAt: now.AddDate(0, 0, -100)},
		{Module: "asset", Action: "create", Success: true, ResourceName: "new-1", CreatedAt: now.Add(-4 * time.Hour)},
		{Module: "asset", Action: "create", Success: true, ResourceName: "new-2", CreatedAt: now.Add(-3 * time.Hour)},
		{Module: "asset", Action: "create", Success: true, ResourceName: "new-3", CreatedAt: now.Add(-2 * time.Hour)},
		{Module: "asset", Action: "create", Success: true, ResourceName: "new-4", CreatedAt: now.Add(-1 * time.Hour)},
	}
	for i := range entries {
		if err := db.Create(&entries[i]).Error; err != nil {
			t.Fatalf("create audit log %d: %v", i, err)
		}
	}

	summary, err := repo.Cleanup(now.AddDate(0, 0, -90), 2)
	if err != nil {
		t.Fatalf("cleanup: %v", err)
	}
	if summary.TotalBefore != 7 {
		t.Fatalf("expected total before 7, got %d", summary.TotalBefore)
	}
	if summary.DeletedByAge != 3 {
		t.Fatalf("expected delete by age 3, got %d", summary.DeletedByAge)
	}
	if summary.DeletedByCount != 2 {
		t.Fatalf("expected delete by count 2, got %d", summary.DeletedByCount)
	}
	if summary.TotalAfter != 2 {
		t.Fatalf("expected total after 2, got %d", summary.TotalAfter)
	}

	var remaining []auditModel.AuditLog
	if err := db.Order("created_at desc").Find(&remaining).Error; err != nil {
		t.Fatalf("query remaining: %v", err)
	}
	if len(remaining) != 2 {
		t.Fatalf("expected 2 remaining logs, got %d", len(remaining))
	}
	if remaining[0].ResourceName != "new-4" || remaining[1].ResourceName != "new-3" {
		t.Fatalf("unexpected remaining logs: %#v", remaining)
	}
}
