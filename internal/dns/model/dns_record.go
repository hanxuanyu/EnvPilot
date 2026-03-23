package model

import (
	"strings"
	"time"

	assetModel "EnvPilot/internal/asset/model"
)

type RecordType string

const (
	RecordTypeA     RecordType = "A"
	RecordTypeCNAME RecordType = "CNAME"
)

type MatchMode string

const (
	MatchModeExact    MatchMode = "exact"
	MatchModeWildcard MatchMode = "wildcard"
	MatchModeRegex    MatchMode = "regex"
)

type DNSRecord struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	EnvironmentID uint       `gorm:"not null;index" json:"environment_id"`
	AssetID       *uint      `gorm:"index" json:"asset_id,omitempty"`
	Domain        string     `gorm:"size:255;not null;index" json:"domain"`
	RecordType    RecordType `gorm:"size:20;not null;default:'A';index" json:"record_type"`
	MatchMode     MatchMode  `gorm:"size:20;not null;default:'exact';index" json:"match_mode"`
	Value         string     `gorm:"size:500;not null" json:"value"`
	TTL           int        `gorm:"not null;default:300" json:"ttl"`
	Enabled       bool       `gorm:"not null;default:true;index" json:"enabled"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`

	Environment assetModel.Environment `gorm:"foreignKey:EnvironmentID" json:"environment,omitempty"`
	Asset       *assetModel.Asset      `gorm:"foreignKey:AssetID" json:"asset,omitempty"`
}

func (r *DNSRecord) Normalize() {
	r.Domain = normalizeDomain(r.Domain)
	r.Value = strings.TrimSpace(r.Value)
	if r.RecordType == "" {
		r.RecordType = RecordTypeA
	}
	if r.MatchMode == "" {
		r.MatchMode = MatchModeExact
	}
	if r.TTL <= 0 {
		r.TTL = 300
	}
	if r.RecordType == RecordTypeCNAME {
		r.Value = normalizeDomain(r.Value)
	}
}

func normalizeDomain(domain string) string {
	domain = strings.TrimSpace(strings.ToLower(domain))
	return strings.TrimSuffix(domain, ".")
}
