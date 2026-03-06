package repository

import (
	"time"

	"EnvPilot/internal/executor/model"

	"gorm.io/gorm"
)

// ExecutionRepo 执行记录数据访问对象
type ExecutionRepo struct {
	db *gorm.DB
}

func NewExecutionRepo(db *gorm.DB) *ExecutionRepo {
	return &ExecutionRepo{db: db}
}

// ExecutionQuery 执行记录查询条件
type ExecutionQuery struct {
	AssetID  uint
	Status   model.ExecutionStatus
	Page     int
	PageSize int
}

func (r *ExecutionRepo) Create(e *model.Execution) error {
	return r.db.Create(e).Error
}

func (r *ExecutionRepo) Update(e *model.Execution) error {
	return r.db.Save(e).Error
}

func (r *ExecutionRepo) FindByID(id uint) (*model.Execution, error) {
	var e model.Execution
	err := r.db.First(&e, id).Error
	return &e, err
}

// List 分页查询执行记录（倒序）
func (r *ExecutionRepo) List(q ExecutionQuery) ([]model.Execution, int64, error) {
	tx := r.db.Model(&model.Execution{})

	if q.AssetID > 0 {
		tx = tx.Where("asset_id = ?", q.AssetID)
	}
	if q.Status != "" {
		tx = tx.Where("status = ?", q.Status)
	}

	var count int64
	if err := tx.Count(&count).Error; err != nil {
		return nil, 0, err
	}

	page := q.Page
	if page <= 0 {
		page = 1
	}
	pageSize := q.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	var list []model.Execution
	err := tx.Order("created_at desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&list).Error
	return list, count, err
}

// Finish 标记执行完成，更新状态、输出和结束时间
func (r *ExecutionRepo) Finish(id uint, status model.ExecutionStatus, output string, exitCode int) error {
	now := time.Now()
	return r.db.Model(&model.Execution{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":      status,
			"output":      output,
			"exit_code":   exitCode,
			"finished_at": now,
		}).Error
}
