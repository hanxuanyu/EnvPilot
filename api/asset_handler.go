package api

import (
	"net/http"

	"EnvPilot/internal/asset/model"
	"EnvPilot/internal/asset/repository"
	assetSvc "EnvPilot/internal/asset/service"
	"EnvPilot/internal/plugin"
)

// AssetHandler 资产管理 HTTP handler
type AssetHandler struct {
	envSvc  *assetSvc.EnvironmentService
	grpSvc  *assetSvc.GroupService
	astSvc  *assetSvc.AssetService
	credSvc *assetSvc.CredentialService
}

func NewAssetHandler(
	envSvc *assetSvc.EnvironmentService,
	grpSvc *assetSvc.GroupService,
	astSvc *assetSvc.AssetService,
	credSvc *assetSvc.CredentialService,
) *AssetHandler {
	return &AssetHandler{envSvc: envSvc, grpSvc: grpSvc, astSvc: astSvc, credSvc: credSvc}
}

// ── 插件 ──────────────────────────────────────────────────────────

// GET /api/plugins?category=
func (h *AssetHandler) ListPlugins(w http.ResponseWriter, r *http.Request) {
	category := plugin.AssetCategory(r.URL.Query().Get("category"))
	list := h.astSvc.ListPlugins(category)
	writeOK(w, list)
}

// GET /api/plugins/{type}/schema
func (h *AssetHandler) GetPluginSchema(w http.ResponseWriter, r *http.Request) {
	pluginType := r.PathValue("type")
	def, err := h.astSvc.GetPluginSchema(pluginType)
	if err != nil {
		writeFail(w, http.StatusNotFound, err.Error())
		return
	}
	writeOK(w, def)
}

// ── 环境 ──────────────────────────────────────────────────────────

// GET /api/environments
func (h *AssetHandler) ListEnvironments(w http.ResponseWriter, r *http.Request) {
	list, err := h.envSvc.ListAll()
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

// POST /api/environments
func (h *AssetHandler) CreateEnvironment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	env, err := h.envSvc.Create(req.Name, req.Description, req.Color)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, env)
}

// PUT /api/environments/{id}
func (h *AssetHandler) UpdateEnvironment(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Color       string `json:"color"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	env, err := h.envSvc.Update(id, req.Name, req.Description, req.Color)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, env)
}

// DELETE /api/environments/{id}
func (h *AssetHandler) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	if err := h.envSvc.Delete(id); err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, true)
}

// ── 分组 ──────────────────────────────────────────────────────────

// GET /api/groups?environment_id=
func (h *AssetHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
	envID := queryUint(r, "environment_id")
	list, err := h.grpSvc.ListByEnvironment(envID)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

// POST /api/groups
func (h *AssetHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		EnvironmentID uint   `json:"environment_id"`
		Name          string `json:"name"`
		Description   string `json:"description"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	g, err := h.grpSvc.Create(req.EnvironmentID, req.Name, req.Description)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, g)
}

// PUT /api/groups/{id}
func (h *AssetHandler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	g, err := h.grpSvc.Update(id, req.Name, req.Description)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, g)
}

// DELETE /api/groups/{id}
func (h *AssetHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	if err := h.grpSvc.Delete(id); err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, true)
}

// ── 资产 ──────────────────────────────────────────────────────────

// GET /api/assets?environment_id=&group_id=&category=&plugin_type=&keyword=
func (h *AssetHandler) ListAssets(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	list, err := h.astSvc.List(repository.AssetFilter{
		EnvironmentID: queryUint(r, "environment_id"),
		GroupID:       queryUint(r, "group_id"),
		Category:      plugin.AssetCategory(q.Get("category")),
		PluginType:    q.Get("plugin_type"),
		Keyword:       q.Get("keyword"),
	})
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

// GET /api/assets/{id}
func (h *AssetHandler) GetAsset(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	asset, err := h.astSvc.GetByID(id)
	if err != nil {
		writeFail(w, http.StatusNotFound, err.Error())
		return
	}
	writeOK(w, asset)
}

// POST /api/assets
func (h *AssetHandler) CreateAsset(w http.ResponseWriter, r *http.Request) {
	var req assetSvc.CreateAssetRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	asset, err := h.astSvc.Create(req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, asset)
}

// PUT /api/assets/{id}
func (h *AssetHandler) UpdateAsset(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req assetSvc.UpdateAssetRequest
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	req.ID = id
	asset, err := h.astSvc.Update(req)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, asset)
}

// DELETE /api/assets/{id}
func (h *AssetHandler) DeleteAsset(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	if err := h.astSvc.Delete(id); err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, true)
}

// ── 凭据 ──────────────────────────────────────────────────────────

// GET /api/credentials
func (h *AssetHandler) ListCredentials(w http.ResponseWriter, r *http.Request) {
	list, err := h.credSvc.ListAll()
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, list)
}

// POST /api/credentials
func (h *AssetHandler) CreateCredential(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string               `json:"name"`
		Type     model.CredentialType `json:"type"`
		Username string               `json:"username"`
		Secret   string               `json:"secret"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	c, err := h.credSvc.Create(req.Name, req.Type, req.Username, req.Secret)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, c)
}

// PUT /api/credentials/{id}
func (h *AssetHandler) UpdateCredential(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	var req struct {
		Name     string               `json:"name"`
		Type     model.CredentialType `json:"type"`
		Username string               `json:"username"`
		Secret   string               `json:"secret"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeFail(w, http.StatusBadRequest, "请求格式错误")
		return
	}
	c, err := h.credSvc.Update(id, req.Name, req.Type, req.Username, req.Secret)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, c)
}

// DELETE /api/credentials/{id}
func (h *AssetHandler) DeleteCredential(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	if err := h.credSvc.Delete(id); err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, true)
}

// POST /api/credentials/{id}/reveal
func (h *AssetHandler) RevealCredential(w http.ResponseWriter, r *http.Request) {
	id, err := pathUint(r, "id")
	if err != nil {
		writeFail(w, http.StatusBadRequest, "无效的 ID")
		return
	}
	plain, err := h.credSvc.RevealSecret(id)
	if err != nil {
		writeFail(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeOK(w, plain)
}
