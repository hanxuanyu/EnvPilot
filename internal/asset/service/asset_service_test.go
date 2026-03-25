package service

import (
	"testing"

	"EnvPilot/internal/asset/model"
	assetRepo "EnvPilot/internal/asset/repository"
	dnsModel "EnvPilot/internal/dns/model"
	dnsRepo "EnvPilot/internal/dns/repository"
	dnsSvc "EnvPilot/internal/dns/service"
	"EnvPilot/internal/plugin"
	_ "EnvPilot/internal/plugin/builtin"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type recordingInvalidator struct {
	assetIDs []uint
}

func (r *recordingInvalidator) InvalidateAssetConnections(assetID uint) {
	r.assetIDs = append(r.assetIDs, assetID)
}

func TestAssetServiceUpdatePersistsEnvironmentCredentialAndDNS(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:asset_service_update?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Environment{}, &model.Group{}, &model.Credential{}, &model.Asset{}, &dnsModel.DNSRecord{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	assetRepository := assetRepo.NewAssetRepo(db)
	envRepo := assetRepo.NewEnvironmentRepo(db)
	credRepo := assetRepo.NewCredentialRepo(db)
	dnsRepository := dnsRepo.NewDNSRepo(db)
	dnsService := dnsSvc.NewDNSService(dnsRepository, nil, envRepo, assetRepository, nil)
	service := NewAssetService(assetRepository, envRepo, credRepo, dnsService, nil)
	invalidator := &recordingInvalidator{}
	service.SetConnectionInvalidator(invalidator)

	envOne := &model.Environment{Name: "生产环境", Color: "#000000"}
	envTwo := &model.Environment{Name: "预发环境", Color: "#ffffff"}
	if err := db.Create(envOne).Error; err != nil {
		t.Fatalf("create env one: %v", err)
	}
	if err := db.Create(envTwo).Error; err != nil {
		t.Fatalf("create env two: %v", err)
	}

	credOne := &model.Credential{Name: "cred-one", Type: model.CredentialTypePassword, Username: "root", Secret: "enc-1"}
	credTwo := &model.Credential{Name: "cred-two", Type: model.CredentialTypePassword, Username: "admin", Secret: "enc-2"}
	if err := db.Create(credOne).Error; err != nil {
		t.Fatalf("create credential one: %v", err)
	}
	if err := db.Create(credTwo).Error; err != nil {
		t.Fatalf("create credential two: %v", err)
	}

	created, err := service.Create(CreateAssetRequest{
		EnvironmentID: envOne.ID,
		Category:      plugin.CategoryServer,
		PluginType:    "linux_server",
		Name:          "srv-app-01",
		Description:   "before update",
		CredentialID:  &credOne.ID,
		ExtConfig:     model.ExtConfig{"host": "10.0.0.10", "port": 22},
		DNSConfig:     &AssetDNSConfig{Enabled: true, TTL: 600},
	})
	if err != nil {
		t.Fatalf("create asset: %v", err)
	}

	updated, err := service.Update(UpdateAssetRequest{
		ID:            created.ID,
		EnvironmentID: envTwo.ID,
		Name:          "srv-app-01",
		Description:   "after update",
		Tags:          model.Tags{"ssh", "pre"},
		CredentialID:  &credTwo.ID,
		ExtConfig:     model.ExtConfig{"host": "10.0.1.20", "port": 2222},
		DNSConfig:     &AssetDNSConfig{Enabled: true, TTL: 120},
	})
	if err != nil {
		t.Fatalf("update asset: %v", err)
	}

	if updated.EnvironmentID != envTwo.ID {
		t.Fatalf("expected environment_id %d, got %d", envTwo.ID, updated.EnvironmentID)
	}
	if updated.CredentialID == nil || *updated.CredentialID != credTwo.ID {
		t.Fatalf("expected credential_id %d, got %v", credTwo.ID, updated.CredentialID)
	}

	reloaded, err := assetRepository.FindByID(created.ID)
	if err != nil {
		t.Fatalf("reload asset: %v", err)
	}
	if reloaded.EnvironmentID != envTwo.ID {
		t.Fatalf("expected reloaded environment_id %d, got %d", envTwo.ID, reloaded.EnvironmentID)
	}
	if reloaded.CredentialID == nil || *reloaded.CredentialID != credTwo.ID {
		t.Fatalf("expected reloaded credential_id %d, got %v", credTwo.ID, reloaded.CredentialID)
	}

	record, err := dnsService.GetByAssetID(created.ID)
	if err != nil {
		t.Fatalf("get dns by asset: %v", err)
	}
	if record.EnvironmentID != envTwo.ID {
		t.Fatalf("expected dns environment_id %d, got %d", envTwo.ID, record.EnvironmentID)
	}
	expectedDomain := recommendAssetDomain(updated.Name, updated.PluginType, envTwo.Name)
	if record.Domain != expectedDomain {
		t.Fatalf("expected dns domain %q, got %q", expectedDomain, record.Domain)
	}
	if record.TTL != 120 {
		t.Fatalf("expected dns ttl 120, got %d", record.TTL)
	}
	if len(invalidator.assetIDs) != 1 || invalidator.assetIDs[0] != created.ID {
		t.Fatalf("expected invalidation for asset %d, got %#v", created.ID, invalidator.assetIDs)
	}
}
