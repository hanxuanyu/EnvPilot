package service

import (
	"strings"
	"testing"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/internal/plugin"
	"EnvPilot/pkg/crypto"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestCredentialServiceDeleteBlocksWhenAssetsStillBound(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:credential_delete_bound?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Environment{}, &model.Group{}, &model.Credential{}, &model.Asset{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	assetRepo := repository.NewAssetRepo(db)
	credRepo := repository.NewCredentialRepo(db)
	cipher, err := crypto.NewAESCipher([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("new cipher: %v", err)
	}
	svc := NewCredentialService(credRepo, assetRepo, cipher, nil)

	env := &model.Environment{Name: "生产", Color: "#000000"}
	if err := db.Create(env).Error; err != nil {
		t.Fatalf("create environment: %v", err)
	}

	group := &model.Group{EnvironmentID: env.ID, Name: "核心数据库"}
	if err := db.Create(group).Error; err != nil {
		t.Fatalf("create group: %v", err)
	}

	cred := &model.Credential{Name: "root-login", Type: model.CredentialTypePassword, Username: "root", Secret: "enc"}
	if err := db.Create(cred).Error; err != nil {
		t.Fatalf("create credential: %v", err)
	}

	asset := &model.Asset{
		EnvironmentID: env.ID,
		GroupID:       &group.ID,
		Category:      plugin.CategoryDatabase,
		PluginType:    "mysql",
		Name:          "mysql-primary",
		CredentialID:  &cred.ID,
		ExtConfig:     model.ExtConfig{"host": "127.0.0.1", "port": 3306},
	}
	if err := db.Create(asset).Error; err != nil {
		t.Fatalf("create asset: %v", err)
	}

	err = svc.Delete(cred.ID)
	if err == nil {
		t.Fatal("expected delete to fail when credential is still bound")
	}
	assetNames, namesErr := svc.GetBoundAssetNames(cred.ID)
	if namesErr != nil {
		t.Fatalf("expected get bound asset names to succeed: %v", namesErr)
	}
	if len(assetNames) != 1 || assetNames[0] != "生产 / 核心数据库 / mysql-primary" {
		t.Fatalf("unexpected bound asset names: %#v", assetNames)
	}
	if !IsCredentialBoundError(err) {
		t.Fatalf("expected credential bound error, got %T: %v", err, err)
	}
	if !strings.Contains(err.Error(), "生产 / 核心数据库 / mysql-primary") {
		t.Fatalf("expected bound asset details in error, got %q", err.Error())
	}

	if _, err := credRepo.FindByID(cred.ID); err != nil {
		t.Fatalf("credential should still exist after blocked delete: %v", err)
	}
}

func TestCredentialServiceDeleteSucceedsWhenCredentialUnbound(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:credential_delete_unbound?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Environment{}, &model.Group{}, &model.Credential{}, &model.Asset{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	assetRepo := repository.NewAssetRepo(db)
	credRepo := repository.NewCredentialRepo(db)
	cipher, err := crypto.NewAESCipher([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("new cipher: %v", err)
	}
	svc := NewCredentialService(credRepo, assetRepo, cipher, nil)

	cred := &model.Credential{Name: "free-cred", Type: model.CredentialTypePassword, Username: "user", Secret: "enc"}
	if err := db.Create(cred).Error; err != nil {
		t.Fatalf("create credential: %v", err)
	}

	if err := svc.Delete(cred.ID); err != nil {
		t.Fatalf("expected delete to succeed: %v", err)
	}

	if _, err := credRepo.FindByID(cred.ID); err == nil {
		t.Fatal("expected credential to be deleted")
	}
}

func TestCredentialServiceUpdateRotatesSecretAndInvalidatesBoundAssetConnections(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:credential_update_invalidate?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Environment{}, &model.Group{}, &model.Credential{}, &model.Asset{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	assetRepo := repository.NewAssetRepo(db)
	credRepo := repository.NewCredentialRepo(db)
	cipher, err := crypto.NewAESCipher([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatalf("new cipher: %v", err)
	}
	svc := NewCredentialService(credRepo, assetRepo, cipher, nil)
	invalidator := &recordingInvalidator{}
	svc.SetConnectionInvalidator(invalidator)

	env := &model.Environment{Name: "生产", Color: "#000000"}
	if err := db.Create(env).Error; err != nil {
		t.Fatalf("create environment: %v", err)
	}

	created, err := svc.Create("root-login", model.CredentialTypePassword, "root", "old-secret")
	if err != nil {
		t.Fatalf("create credential: %v", err)
	}

	asset := &model.Asset{
		EnvironmentID: env.ID,
		Category:      plugin.CategoryServer,
		PluginType:    "linux_server",
		Name:          "jump-host",
		CredentialID:  &created.ID,
		ExtConfig:     model.ExtConfig{"host": "127.0.0.1", "port": 22},
	}
	if err := db.Create(asset).Error; err != nil {
		t.Fatalf("create asset: %v", err)
	}

	updated, err := svc.Update(created.ID, "root-login-new", model.CredentialTypePassword, "admin", "new-secret")
	if err != nil {
		t.Fatalf("update credential: %v", err)
	}
	if updated.Name != "root-login-new" || updated.Username != "admin" {
		t.Fatalf("unexpected updated credential: %#v", updated)
	}

	plain, err := svc.RevealSecret(created.ID)
	if err != nil {
		t.Fatalf("reveal secret: %v", err)
	}
	if plain != "new-secret" {
		t.Fatalf("expected new secret to be persisted, got %q", plain)
	}

	if len(invalidator.assetIDs) != 1 || invalidator.assetIDs[0] != asset.ID {
		t.Fatalf("expected invalidation for asset %d, got %#v", asset.ID, invalidator.assetIDs)
	}
}
