// Package assetapi 定义资产管理模块对前端暴露的所有接口。
package assetapi

import (
	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/internal/asset/service"
	"EnvPilot/internal/plugin"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

type AssetAPI struct {
	envSvc  *service.EnvironmentService
	grpSvc  *service.GroupService
	astSvc  *service.AssetService
	credSvc *service.CredentialService
	log     *zap.Logger
}

func NewAssetAPI(
	envSvc *service.EnvironmentService,
	grpSvc *service.GroupService,
	astSvc *service.AssetService,
	credSvc *service.CredentialService,
) *AssetAPI {
	return &AssetAPI{
		envSvc:  envSvc,
		grpSvc:  grpSvc,
		astSvc:  astSvc,
		credSvc: credSvc,
		log:     logger.Named("asset_api"),
	}
}

// ── 插件管理 ──

// ListPlugins 列出已注册插件；category 为空字符串时返回全部
func (a *AssetAPI) ListPlugins(category string) Result[[]*plugin.PluginDef] {
	list := a.astSvc.ListPlugins(plugin.AssetCategory(category))
	return OK(list)
}

// GetPluginSchema 获取指定插件的配置 Schema
func (a *AssetAPI) GetPluginSchema(pluginType string) Result[*plugin.PluginDef] {
	def, err := a.astSvc.GetPluginSchema(pluginType)
	if err != nil {
		return Fail[*plugin.PluginDef](err.Error())
	}
	return OK(def)
}

// ── 环境管理 ──

type CreateEnvironmentReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

func (a *AssetAPI) CreateEnvironment(req CreateEnvironmentReq) Result[*model.Environment] {
	env, err := a.envSvc.Create(req.Name, req.Description, req.Color)
	if err != nil {
		a.log.Warn("创建环境失败", zap.Error(err))
		return Fail[*model.Environment](err.Error())
	}
	return OK(env)
}

type UpdateEnvironmentReq struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

func (a *AssetAPI) UpdateEnvironment(req UpdateEnvironmentReq) Result[*model.Environment] {
	env, err := a.envSvc.Update(req.ID, req.Name, req.Description, req.Color)
	if err != nil {
		return Fail[*model.Environment](err.Error())
	}
	return OK(env)
}

func (a *AssetAPI) DeleteEnvironment(id uint) Result[bool] {
	if err := a.envSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *AssetAPI) ListEnvironments() Result[[]model.Environment] {
	list, err := a.envSvc.ListAll()
	if err != nil {
		return Fail[[]model.Environment](err.Error())
	}
	return OK(list)
}

// ── 分组管理 ──

type CreateGroupReq struct {
	EnvironmentID uint   `json:"environment_id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
}

func (a *AssetAPI) CreateGroup(req CreateGroupReq) Result[*model.Group] {
	g, err := a.grpSvc.Create(req.EnvironmentID, req.Name, req.Description)
	if err != nil {
		return Fail[*model.Group](err.Error())
	}
	return OK(g)
}

type UpdateGroupReq struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (a *AssetAPI) UpdateGroup(req UpdateGroupReq) Result[*model.Group] {
	g, err := a.grpSvc.Update(req.ID, req.Name, req.Description)
	if err != nil {
		return Fail[*model.Group](err.Error())
	}
	return OK(g)
}

func (a *AssetAPI) DeleteGroup(id uint) Result[bool] {
	if err := a.grpSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *AssetAPI) ListGroupsByEnvironment(envID uint) Result[[]model.Group] {
	list, err := a.grpSvc.ListByEnvironment(envID)
	if err != nil {
		return Fail[[]model.Group](err.Error())
	}
	return OK(list)
}

// ── 资产管理 ──

type CreateAssetReq struct {
	EnvironmentID uint                 `json:"environment_id"`
	GroupID       *uint                `json:"group_id"`
	Category      plugin.AssetCategory `json:"category"`
	PluginType    string               `json:"plugin_type"`
	Name          string               `json:"name"`
	Description   string               `json:"description"`
	Tags          model.Tags           `json:"tags"`
	CredentialID  *uint                `json:"credential_id"`
	ExtConfig     model.ExtConfig      `json:"ext_config"`
}

func (a *AssetAPI) CreateAsset(req CreateAssetReq) Result[*model.Asset] {
	asset, err := a.astSvc.Create(service.CreateAssetRequest{
		EnvironmentID: req.EnvironmentID,
		GroupID:       req.GroupID,
		Category:      req.Category,
		PluginType:    req.PluginType,
		Name:          req.Name,
		Description:   req.Description,
		Tags:          req.Tags,
		CredentialID:  req.CredentialID,
		ExtConfig:     req.ExtConfig,
	})
	if err != nil {
		return Fail[*model.Asset](err.Error())
	}
	return OK(asset)
}

type UpdateAssetReq struct {
	ID           uint            `json:"id"`
	GroupID      *uint           `json:"group_id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	Tags         model.Tags      `json:"tags"`
	CredentialID *uint           `json:"credential_id"`
	ExtConfig    model.ExtConfig `json:"ext_config"`
}

func (a *AssetAPI) UpdateAsset(req UpdateAssetReq) Result[*model.Asset] {
	asset, err := a.astSvc.Update(service.UpdateAssetRequest{
		ID:           req.ID,
		GroupID:      req.GroupID,
		Name:         req.Name,
		Description:  req.Description,
		Tags:         req.Tags,
		CredentialID: req.CredentialID,
		ExtConfig:    req.ExtConfig,
	})
	if err != nil {
		return Fail[*model.Asset](err.Error())
	}
	return OK(asset)
}

func (a *AssetAPI) DeleteAsset(id uint) Result[bool] {
	if err := a.astSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *AssetAPI) GetAsset(id uint) Result[*model.Asset] {
	asset, err := a.astSvc.GetByID(id)
	if err != nil {
		return Fail[*model.Asset](err.Error())
	}
	return OK(asset)
}

type ListAssetsReq struct {
	EnvironmentID uint                 `json:"environment_id"`
	GroupID       uint                 `json:"group_id"`
	Category      plugin.AssetCategory `json:"category"`
	PluginType    string               `json:"plugin_type"`
	Keyword       string               `json:"keyword"`
}

func (a *AssetAPI) ListAssets(req ListAssetsReq) Result[[]model.Asset] {
	list, err := a.astSvc.List(repository.AssetFilter{
		EnvironmentID: req.EnvironmentID,
		GroupID:       req.GroupID,
		Category:      req.Category,
		PluginType:    req.PluginType,
		Keyword:       req.Keyword,
	})
	if err != nil {
		return Fail[[]model.Asset](err.Error())
	}
	return OK(list)
}

// ── 凭据管理 ──

type CreateCredentialReq struct {
	Name     string               `json:"name"`
	Type     model.CredentialType `json:"type"`
	Username string               `json:"username"`
	Secret   string               `json:"secret"`
}

func (a *AssetAPI) CreateCredential(req CreateCredentialReq) Result[*model.Credential] {
	c, err := a.credSvc.Create(req.Name, req.Type, req.Username, req.Secret)
	if err != nil {
		return Fail[*model.Credential](err.Error())
	}
	return OK(c)
}

type UpdateCredentialReq struct {
	ID       uint                 `json:"id"`
	Name     string               `json:"name"`
	Type     model.CredentialType `json:"type"`
	Username string               `json:"username"`
	Secret   string               `json:"secret"`
}

func (a *AssetAPI) UpdateCredential(req UpdateCredentialReq) Result[*model.Credential] {
	c, err := a.credSvc.Update(req.ID, req.Name, req.Type, req.Username, req.Secret)
	if err != nil {
		return Fail[*model.Credential](err.Error())
	}
	return OK(c)
}

func (a *AssetAPI) DeleteCredential(id uint) Result[bool] {
	if err := a.credSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

func (a *AssetAPI) ListCredentials() Result[[]model.Credential] {
	list, err := a.credSvc.ListAll()
	if err != nil {
		return Fail[[]model.Credential](err.Error())
	}
	return OK(list)
}

// RevealCredential 明文查看凭据（需二次确认，操作将被审计）
func (a *AssetAPI) RevealCredential(id uint) Result[string] {
	plain, err := a.credSvc.RevealSecret(id)
	if err != nil {
		return Fail[string](err.Error())
	}
	return OK(plain)
}
