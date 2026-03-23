package repository

import (
	"EnvPilot/internal/dns/model"

	"gorm.io/gorm"
)

type DNSFilter struct {
	EnvironmentID uint
	Keyword       string
	Enabled       *bool
}

type DNSRepo struct {
	db *gorm.DB
}

func NewDNSRepo(db *gorm.DB) *DNSRepo {
	return &DNSRepo{db: db}
}

func (r *DNSRepo) Create(record *model.DNSRecord) error {
	return r.db.Create(record).Error
}

func (r *DNSRepo) Update(record *model.DNSRecord) error {
	return r.db.Save(record).Error
}

func (r *DNSRepo) Delete(id uint) error {
	return r.db.Delete(&model.DNSRecord{}, id).Error
}

func (r *DNSRepo) FindByID(id uint) (*model.DNSRecord, error) {
	var record model.DNSRecord
	err := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment").
		First(&record, id).Error
	return &record, err
}

func (r *DNSRepo) FindByAssetID(assetID uint) (*model.DNSRecord, error) {
	var record model.DNSRecord
	err := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment").
		Where("asset_id = ?", assetID).
		First(&record).Error
	return &record, err
}

func (r *DNSRepo) List(filter DNSFilter) ([]model.DNSRecord, error) {
	tx := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment")

	if filter.EnvironmentID > 0 {
		tx = tx.Where("environment_id = ?", filter.EnvironmentID)
	}
	if filter.Keyword != "" {
		like := "%" + filter.Keyword + "%"
		tx = tx.Where("domain LIKE ? OR value LIKE ?", like, like)
	}
	if filter.Enabled != nil {
		tx = tx.Where("enabled = ?", *filter.Enabled)
	}

	var list []model.DNSRecord
	err := tx.Order("domain asc").Order("record_type asc").Find(&list).Error
	return list, err
}

func (r *DNSRepo) ListEnabledByDomain(domain string) ([]model.DNSRecord, error) {
	var list []model.DNSRecord
	err := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment").
		Where("domain = ? AND enabled = ?", domain, true).
		Order("environment_id asc").
		Order("record_type asc").
		Find(&list).Error
	return list, err
}

func (r *DNSRepo) ListEnabledByEnvironmentAndDomain(environmentID uint, domain string) ([]model.DNSRecord, error) {
	var list []model.DNSRecord
	err := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment").
		Where("environment_id = ? AND domain = ? AND enabled = ?", environmentID, domain, true).
		Order("record_type asc").
		Find(&list).Error
	return list, err
}

func (r *DNSRepo) ExistsByUniqueKey(environmentID uint, domain string, recordType model.RecordType, excludeID uint) (bool, error) {
	var count int64
	q := r.db.Model(&model.DNSRecord{}).
		Where("environment_id = ? AND domain = ? AND record_type = ?", environmentID, domain, recordType)
	if excludeID > 0 {
		q = q.Where("id != ?", excludeID)
	}
	err := q.Count(&count).Error
	return count > 0, err
}

func (r *DNSRepo) DeleteByAssetID(assetID uint) error {
	return r.db.Where("asset_id = ?", assetID).Delete(&model.DNSRecord{}).Error
}

// ListEnabledNonExact 查询所有启用的非精确匹配记录（通配符/正则）
func (r *DNSRepo) ListEnabledNonExact() ([]model.DNSRecord, error) {
	var list []model.DNSRecord
	err := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment").
		Where("enabled = ? AND match_mode != ?", true, "exact").
		Find(&list).Error
	return list, err
}

// ListEnabledNonExactByEnvironment 查询指定环境下启用的非精确匹配记录
func (r *DNSRepo) ListEnabledNonExactByEnvironment(environmentID uint) ([]model.DNSRecord, error) {
	var list []model.DNSRecord
	err := r.db.
		Preload("Environment").
		Preload("Asset").
		Preload("Asset.Environment").
		Where("environment_id = ? AND enabled = ? AND match_mode != ?", environmentID, true, "exact").
		Find(&list).Error
	return list, err
}
