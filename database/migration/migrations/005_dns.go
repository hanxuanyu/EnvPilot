package migrations

import (
	dnsModel "EnvPilot/internal/dns/model"

	"gorm.io/gorm"
)

func MigrateDNS(db *gorm.DB) error {
	return db.AutoMigrate(&dnsModel.DNSRecord{})
}
