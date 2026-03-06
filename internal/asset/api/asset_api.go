// Package assetapi 定义资产管理模块对前端暴露的所有接口。
//
// 设计原则：
//   - API 方法作为 Wails 绑定方法，参数和返回值必须是 JSON 可序列化类型
//   - 统一返回 Result 结构体，前端统一处理
//   - API 层只做参数转换和错误格式化，业务逻辑在 service 层
//   - 包名 assetapi 确保 Wails binding 生成器不与其他模块冲突
package assetapi

import (
	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	"EnvPilot/internal/asset/service"
	"EnvPilot/pkg/logger"

	"go.uber.org/zap"
)

// AssetAPI 资产管理模块的 Wails 绑定结构体
// 挂载了环境、分组、资产、凭据四个子模块的接口
type AssetAPI struct {
	envSvc  *service.EnvironmentService
	grpSvc  *service.GroupService
	astSvc  *service.AssetService
	credSvc *service.CredentialService
	log     *zap.Logger
}

// NewAssetAPI 创建 AssetAPI，注入所有子模块 service
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

// ==================== 环境管理 ====================

// CreateEnvironmentReq 创建环境请求
type CreateEnvironmentReq struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// CreateEnvironment 创建环境
func (a *AssetAPI) CreateEnvironment(req CreateEnvironmentReq) Result[*model.Environment] {
	env, err := a.envSvc.Create(req.Name, req.Description, req.Color)
	if err != nil {
		a.log.Warn("创建环境失败", zap.Error(err))
		return Fail[*model.Environment](err.Error())
	}
	return OK(env)
}

// UpdateEnvironmentReq 更新环境请求
type UpdateEnvironmentReq struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// UpdateEnvironment 更新环境
func (a *AssetAPI) UpdateEnvironment(req UpdateEnvironmentReq) Result[*model.Environment] {
	env, err := a.envSvc.Update(req.ID, req.Name, req.Description, req.Color)
	if err != nil {
		return Fail[*model.Environment](err.Error())
	}
	return OK(env)
}

// DeleteEnvironment 删除环境
func (a *AssetAPI) DeleteEnvironment(id uint) Result[bool] {
	if err := a.envSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

// ListEnvironments 查询所有环境
func (a *AssetAPI) ListEnvironments() Result[[]model.Environment] {
	list, err := a.envSvc.ListAll()
	if err != nil {
		return Fail[[]model.Environment](err.Error())
	}
	return OK(list)
}

// ==================== 分组管理 ====================

// CreateGroupReq 创建分组请求
type CreateGroupReq struct {
	EnvironmentID uint   `json:"environment_id"`
	Name          string `json:"name"`
	Description   string `json:"description"`
}

// CreateGroup 创建分组
func (a *AssetAPI) CreateGroup(req CreateGroupReq) Result[*model.Group] {
	g, err := a.grpSvc.Create(req.EnvironmentID, req.Name, req.Description)
	if err != nil {
		return Fail[*model.Group](err.Error())
	}
	return OK(g)
}

// UpdateGroupReq 更新分组请求
type UpdateGroupReq struct {
	ID          uint   `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// UpdateGroup 更新分组
func (a *AssetAPI) UpdateGroup(req UpdateGroupReq) Result[*model.Group] {
	g, err := a.grpSvc.Update(req.ID, req.Name, req.Description)
	if err != nil {
		return Fail[*model.Group](err.Error())
	}
	return OK(g)
}

// DeleteGroup 删除分组
func (a *AssetAPI) DeleteGroup(id uint) Result[bool] {
	if err := a.grpSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

// ListGroupsByEnvironment 查询某环境下的所有分组
func (a *AssetAPI) ListGroupsByEnvironment(envID uint) Result[[]model.Group] {
	list, err := a.grpSvc.ListByEnvironment(envID)
	if err != nil {
		return Fail[[]model.Group](err.Error())
	}
	return OK(list)
}

// ==================== 资产管理 ====================

// CreateAssetReq 创建资产请求
type CreateAssetReq struct {
	EnvironmentID uint            `json:"environment_id"`
	GroupID       *uint           `json:"group_id"`
	Type          model.AssetType `json:"type"`
	Name          string          `json:"name"`
	Host          string          `json:"host"`
	Port          int             `json:"port"`
	Description   string          `json:"description"`
	Tags          model.Tags      `json:"tags"`
	CredentialID  *uint           `json:"credential_id"`
}

// CreateAsset 创建资产
func (a *AssetAPI) CreateAsset(req CreateAssetReq) Result[*model.Asset] {
	asset, err := a.astSvc.Create(service.CreateAssetRequest{
		EnvironmentID: req.EnvironmentID,
		GroupID:       req.GroupID,
		Type:          req.Type,
		Name:          req.Name,
		Host:          req.Host,
		Port:          req.Port,
		Description:   req.Description,
		Tags:          req.Tags,
		CredentialID:  req.CredentialID,
	})
	if err != nil {
		return Fail[*model.Asset](err.Error())
	}
	return OK(asset)
}

// UpdateAssetReq 更新资产请求
type UpdateAssetReq struct {
	ID           uint       `json:"id"`
	GroupID      *uint      `json:"group_id"`
	Name         string     `json:"name"`
	Host         string     `json:"host"`
	Port         int        `json:"port"`
	Description  string     `json:"description"`
	Tags         model.Tags `json:"tags"`
	CredentialID *uint      `json:"credential_id"`
}

// UpdateAsset 更新资产
func (a *AssetAPI) UpdateAsset(req UpdateAssetReq) Result[*model.Asset] {
	asset, err := a.astSvc.Update(service.UpdateAssetRequest{
		ID:           req.ID,
		GroupID:      req.GroupID,
		Name:         req.Name,
		Host:         req.Host,
		Port:         req.Port,
		Description:  req.Description,
		Tags:         req.Tags,
		CredentialID: req.CredentialID,
	})
	if err != nil {
		return Fail[*model.Asset](err.Error())
	}
	return OK(asset)
}

// DeleteAsset 删除资产
func (a *AssetAPI) DeleteAsset(id uint) Result[bool] {
	if err := a.astSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

// GetAsset 获取单个资产详情
func (a *AssetAPI) GetAsset(id uint) Result[*model.Asset] {
	asset, err := a.astSvc.GetByID(id)
	if err != nil {
		return Fail[*model.Asset](err.Error())
	}
	return OK(asset)
}

// ListAssetsReq 资产列表查询请求
type ListAssetsReq struct {
	EnvironmentID uint            `json:"environment_id"`
	GroupID       uint            `json:"group_id"`
	Type          model.AssetType `json:"type"`
	Keyword       string          `json:"keyword"`
}

// ListAssets 查询资产列表
func (a *AssetAPI) ListAssets(req ListAssetsReq) Result[[]model.Asset] {
	list, err := a.astSvc.List(repository.AssetQuery{
		EnvironmentID: req.EnvironmentID,
		GroupID:       req.GroupID,
		Type:          req.Type,
		Keyword:       req.Keyword,
	})
	if err != nil {
		return Fail[[]model.Asset](err.Error())
	}
	return OK(list)
}

// ==================== 凭据管理 ====================

// CreateCredentialReq 创建凭据请求
type CreateCredentialReq struct {
	Name     string                 `json:"name"`
	Type     model.CredentialType   `json:"type"`
	Username string                 `json:"username"`
	Secret   string                 `json:"secret"`
}

// CreateCredential 创建凭据
func (a *AssetAPI) CreateCredential(req CreateCredentialReq) Result[*model.Credential] {
	c, err := a.credSvc.Create(req.Name, req.Type, req.Username, req.Secret)
	if err != nil {
		return Fail[*model.Credential](err.Error())
	}
	return OK(c)
}

// UpdateCredentialReq 更新凭据请求（secret 为空表示不修改密码）
type UpdateCredentialReq struct {
	ID       uint                   `json:"id"`
	Name     string                 `json:"name"`
	Type     model.CredentialType   `json:"type"`
	Username string                 `json:"username"`
	Secret   string                 `json:"secret"`
}

// UpdateCredential 更新凭据
func (a *AssetAPI) UpdateCredential(req UpdateCredentialReq) Result[*model.Credential] {
	c, err := a.credSvc.Update(req.ID, req.Name, req.Type, req.Username, req.Secret)
	if err != nil {
		return Fail[*model.Credential](err.Error())
	}
	return OK(c)
}

// DeleteCredential 删除凭据
func (a *AssetAPI) DeleteCredential(id uint) Result[bool] {
	if err := a.credSvc.Delete(id); err != nil {
		return Fail[bool](err.Error())
	}
	return OK(true)
}

// ListCredentials 查询所有凭据（脱敏）
func (a *AssetAPI) ListCredentials() Result[[]model.Credential] {
	list, err := a.credSvc.ListAll()
	if err != nil {
		return Fail[[]model.Credential](err.Error())
	}
	return OK(list)
}
