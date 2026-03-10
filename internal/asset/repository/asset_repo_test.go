package repository

import (
	"testing"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/plugin"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func TestAssetRepoUpdateReplacesAndClearsCredentialBinding(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file::memory:?cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}

	if err := db.AutoMigrate(&model.Environment{}, &model.Group{}, &model.Credential{}, &model.Asset{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}

	repo := NewAssetRepo(db)

	env := &model.Environment{Name: "test", Color: "#000000"}
	if err := db.Create(env).Error; err != nil {
		t.Fatalf("create environment: %v", err)
	}

	credOne := &model.Credential{Name: "cred-1", Type: model.CredentialTypePassword, Username: "user-1", Secret: "enc-1"}
	if err := db.Create(credOne).Error; err != nil {
		t.Fatalf("create credential 1: %v", err)
	}

	credTwo := &model.Credential{Name: "cred-2", Type: model.CredentialTypePassword, Username: "user-2", Secret: "enc-2"}
	if err := db.Create(credTwo).Error; err != nil {
		t.Fatalf("create credential 2: %v", err)
	}

	asset := &model.Asset{
		EnvironmentID: env.ID,
		Category:      plugin.CategoryDatabase,
		PluginType:    "mysql",
		Name:          "db-asset",
		CredentialID:  &credOne.ID,
		ExtConfig:     model.ExtConfig{"host": "127.0.0.1", "port": 3306},
	}
	if err := repo.Create(asset); err != nil {
		t.Fatalf("create asset: %v", err)
	}

	loaded, err := repo.FindByID(asset.ID)
	if err != nil {
		t.Fatalf("load asset: %v", err)
	}
	if loaded.Credential == nil || loaded.Credential.ID != credOne.ID {
		t.Fatalf("expected preloaded credential %d, got %#v", credOne.ID, loaded.Credential)
	}

	loaded.CredentialID = &credTwo.ID
	if err := repo.Update(loaded); err != nil {
		t.Fatalf("update asset credential binding: %v", err)
	}

	reloaded, err := repo.FindByID(asset.ID)
	if err != nil {
		t.Fatalf("reload asset after credential switch: %v", err)
	}
	if reloaded.CredentialID == nil || *reloaded.CredentialID != credTwo.ID {
		t.Fatalf("expected credential_id %d, got %v", credTwo.ID, reloaded.CredentialID)
	}
	if reloaded.Credential == nil || reloaded.Credential.ID != credTwo.ID {
		t.Fatalf("expected preloaded credential %d after switch, got %#v", credTwo.ID, reloaded.Credential)
	}

	reloaded.CredentialID = nil
	if err := repo.Update(reloaded); err != nil {
		t.Fatalf("clear asset credential binding: %v", err)
	}

	cleared, err := repo.FindByID(asset.ID)
	if err != nil {
		t.Fatalf("reload asset after credential clear: %v", err)
	}
	if cleared.CredentialID != nil {
		t.Fatalf("expected credential_id to be nil, got %v", *cleared.CredentialID)
	}
	if cleared.Credential != nil {
		t.Fatalf("expected preloaded credential to be nil after clear, got %#v", cleared.Credential)
	}
}
