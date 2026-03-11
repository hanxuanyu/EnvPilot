package app

import (
	"fmt"
	"path/filepath"
	"reflect"
	"strings"

	auditSvc "EnvPilot/internal/audit/service"
	configModel "EnvPilot/internal/config/model"
	configService "EnvPilot/internal/config/service"
	dnsSvc "EnvPilot/internal/dns/service"
	sshpkg "EnvPilot/internal/executor/ssh"
	healthSvc "EnvPilot/internal/health/service"
	"EnvPilot/pkg/logger"

	"gorm.io/gorm"
)

type configRuntimeApplier struct {
	resolveBase string
	db          *gorm.DB
	dnsRuntime  *dnsSvc.ServerRuntime
	healthSvc   *healthSvc.HealthService
	auditSvc    *auditSvc.AuditService
}

func newConfigRuntimeApplier(resolveBase string, db *gorm.DB, dnsRuntime *dnsSvc.ServerRuntime, health *healthSvc.HealthService, audit *auditSvc.AuditService) *configRuntimeApplier {
	return &configRuntimeApplier{
		resolveBase: resolveBase,
		db:          db,
		dnsRuntime:  dnsRuntime,
		healthSvc:   health,
		auditSvc:    audit,
	}
}

func (a *configRuntimeApplier) ApplyConfig(prev, next *configModel.AppConfig) (*configService.HotReloadResult, error) {
	result := &configService.HotReloadResult{}
	if prev == nil || next == nil {
		return result, nil
	}

	resolvedNext := *next
	resolveRelativePaths(&resolvedNext, a.resolveBase)

	errMessages := make([]string, 0)
	if prev.App.Name != next.App.Name {
		result.Applied = appendUnique(result.Applied, "app.name")
	}
	if prev.Security.MasterPasswordEnabled != next.Security.MasterPasswordEnabled {
		result.Applied = appendUnique(result.Applied, "security.master_password_enabled")
	}
	if prev.App.DataDir != next.App.DataDir {
		result.RestartRequired = appendUnique(result.RestartRequired, "app.data_dir")
	}
	if prev.Database.Filename != next.Database.Filename {
		result.RestartRequired = appendUnique(result.RestartRequired, "database.filename")
	}
	if prev.Security.SaltFile != next.Security.SaltFile {
		result.RestartRequired = appendUnique(result.RestartRequired, "security.salt_file")
	}

	if prev.Log != next.Log || prev.App.LogDir != next.App.LogDir {
		if err := a.applyLogger(&resolvedNext); err != nil {
			errMessages = append(errMessages, fmt.Sprintf("日志配置热更新失败: %v", err))
			result.RestartRequired = appendUnique(result.RestartRequired, "log")
		} else {
			result.Applied = appendUnique(result.Applied, "log")
		}
	}

	if prev.Database.MaxIdleConns != next.Database.MaxIdleConns || prev.Database.MaxOpenConns != next.Database.MaxOpenConns {
		if err := a.applyDatabasePool(&resolvedNext); err != nil {
			errMessages = append(errMessages, fmt.Sprintf("数据库连接池热更新失败: %v", err))
			result.RestartRequired = appendUnique(result.RestartRequired, "database.pool")
		} else {
			result.Applied = appendUnique(result.Applied, "database.pool")
		}
	}

	if !reflect.DeepEqual(prev.Security.DangerousCommands, next.Security.DangerousCommands) {
		if err := sshpkg.UpdateDangerousPatterns(next.Security.DangerousCommands); err != nil {
			errMessages = append(errMessages, fmt.Sprintf("危险命令规则热更新失败: %v", err))
			result.RestartRequired = appendUnique(result.RestartRequired, "security.dangerous_commands")
		} else {
			result.Applied = appendUnique(result.Applied, "security.dangerous_commands")
		}
	}

	if prev.DNS != next.DNS {
		if err := a.dnsRuntime.UpdateConfig(resolvedNext.DNS); err != nil {
			errMessages = append(errMessages, fmt.Sprintf("DNS 配置热更新失败: %v", err))
			result.RestartRequired = appendUnique(result.RestartRequired, "dns")
		} else {
			result.Applied = appendUnique(result.Applied, "dns")
		}
	}

	if prev.Health != next.Health {
		a.healthSvc.UpdateConfig(resolvedNext.Health)
		result.Applied = appendUnique(result.Applied, "health")
	}

	if prev.Audit != next.Audit {
		a.auditSvc.UpdateConfig(resolvedNext.Audit)
		result.Applied = appendUnique(result.Applied, "audit")
	}

	if len(errMessages) > 0 {
		result.Messages = append(result.Messages, errMessages...)
		return result, fmt.Errorf("%s", strings.Join(errMessages, "; "))
	}

	if len(result.Applied) == 0 && len(result.RestartRequired) == 0 {
		result.Messages = append(result.Messages, "配置已保存，当前变更无需额外热更新动作")
	}
	return result, nil
}

func (a *configRuntimeApplier) applyLogger(cfg *configModel.AppConfig) error {
	return logger.Init(logger.Config{
		Level:      cfg.Log.Level,
		FilePath:   filepath.Join(cfg.App.LogDir, cfg.Log.Filename),
		MaxSize:    cfg.Log.MaxSize,
		MaxBackups: cfg.Log.MaxBackups,
		MaxAge:     cfg.Log.MaxAge,
		Compress:   cfg.Log.Compress,
	})
}

func (a *configRuntimeApplier) applyDatabasePool(cfg *configModel.AppConfig) error {
	if a.db == nil {
		return nil
	}
	sqlDB, err := a.db.DB()
	if err != nil {
		return err
	}
	sqlDB.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	sqlDB.SetMaxOpenConns(cfg.Database.MaxOpenConns)
	return nil
}

func appendUnique(items []string, value string) []string {
	for _, item := range items {
		if item == value {
			return items
		}
	}
	return append(items, value)
}
