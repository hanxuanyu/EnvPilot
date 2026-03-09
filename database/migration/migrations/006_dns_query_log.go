package migrations

import (
	dnsModel "EnvPilot/internal/dns/model"

	"gorm.io/gorm"
)

func MigrateDNSQueryLog(db *gorm.DB) error {
	return db.AutoMigrate(&dnsModel.DNSQueryLog{})
}
