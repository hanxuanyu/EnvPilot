# ================================================================
# EnvPilot Makefile
#
# 目标：
#   make help            查看命令说明
#   make test-core       测试业务与基础包
#   make build-desktop   桌面版（Wails，macOS/Windows/Linux GUI）
#   make build-server    服务端版（HTTP，可部署到服务器）
#   make build-server-linux  交叉编译 Linux amd64 服务端
#   make build-all       同时构建两种模式
#   make dev             启动桌面开发模式（热更新）
#   make dev-server      启动服务端开发模式（Go + Vite 代理）
#   make clean           清理构建产物
# ================================================================

APP_NAME    := EnvPilot
SERVER_NAME := envpilot-server
BIN_DIR     := bin
FRONTEND    := frontend
DESKTOP_PLATFORM ?=
DESKTOP_OUTPUT   ?= $(APP_NAME)
SERVER_OUTPUT    ?= $(SERVER_NAME)
EXTRA_GO_LDFLAGS ?=
HOST_GO_RUN := GOOS= GOARCH= CGO_ENABLED= go run
BUILD_META_CMD := $(HOST_GO_RUN) ./cmd/buildmeta
GIT_COMMIT  := $(shell $(BUILD_META_CMD) -mode commit 2>/dev/null || echo unknown)
APP_VERSION := $(shell $(BUILD_META_CMD) -mode version 2>/dev/null || echo dev)
LDFLAGS     := -s -w
GO_LDFLAGS  := $(strip $(LDFLAGS) $(EXTRA_GO_LDFLAGS))
WAILS_BUILD_ARGS := -ldflags "$(GO_LDFLAGS)" -o $(DESKTOP_OUTPUT)
ifneq ($(strip $(DESKTOP_PLATFORM)),)
WAILS_BUILD_ARGS += -platform $(DESKTOP_PLATFORM)
endif

# ── 平台检测 ─────────────────────────────────────────────────────
GOOS   ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)
CGO_ENABLED ?=
GO_BUILD_ENV := GOOS=$(GOOS) GOARCH=$(GOARCH)
ifneq ($(strip $(CGO_ENABLED)),)
GO_BUILD_ENV += CGO_ENABLED=$(CGO_ENABLED)
endif

.DEFAULT_GOAL := help

.PHONY: test-core build-desktop build-server build-server-target build-server-linux build-all dev dev-server clean help prepare-server-assets prepare-build-metadata

# ── 默认目标 ─────────────────────────────────────────────────────
help:
	@echo ""
	@echo "EnvPilot 构建脚本"
	@echo "=================================="
	@echo "  make help             查看命令说明"
	@echo "  make test-core        测试业务与基础包（跳过入口打包层）"
	@echo "  make build-desktop   构建桌面版（Wails）"
	@echo "  make build-server    构建服务端版（HTTP）"
	@echo "  make build-server-linux  交叉编译 Linux amd64 服务端"
	@echo "  make build-all       构建两种模式"
	@echo "  make dev             桌面开发模式（wails dev）"
	@echo "  make dev-server      服务端开发模式"
	@echo "  make clean           清理构建产物"
	@echo ""
	@echo "说明：build-server-target 与 prepare-server-assets 为内部辅助目标，不建议直接调用"
	@echo "当前构建版本: $(APP_VERSION) ($(GIT_COMMIT))"
	@echo ""

# ── 测试 ─────────────────────────────────────────────────────────
test-core:
	@echo ">>> 测试业务与基础包（跳过桌面/服务端入口层）..."
	go test ./internal/... ./database/... ./pkg/...

prepare-build-metadata:
	@echo ">>> 同步构建元信息..."
	$(BUILD_META_CMD) -mode sync

# ── 桌面版构建（Wails）──────────────────────────────────────────
# 流程：npm run build（desktop 模式）→ wails build
build-desktop: prepare-build-metadata
	@echo ">>> [1/2] 构建前端（桌面模式）..."
	npm run build --prefix $(FRONTEND)
	@echo ">>> [2/2] 构建 Wails 桌面应用..."
	wails build $(WAILS_BUILD_ARGS)
	@echo ">>> 桌面版构建完成：build/bin/$(APP_NAME)"

# ── 服务端版构建（HTTP）─────────────────────────────────────────
# 流程：npm run build:server → 复制 frontend/dist-server 到 cmd/server/dist → go build
prepare-server-assets:
	@echo ">>> [1/3] 构建前端（服务端模式）..."
	npm run build:server --prefix $(FRONTEND)
	@echo ">>> [2/3] 复制前端资源到内嵌目录..."
	rm -rf cmd/server/dist && mkdir -p cmd/server/dist
	cp -r $(FRONTEND)/dist-server/. cmd/server/dist/

build-server: SERVER_OUTPUT := $(SERVER_NAME)
build-server: prepare-build-metadata prepare-server-assets
	@echo ">>> [3/3] 编译 Go 服务端二进制..."
	mkdir -p $(BIN_DIR)
	$(GO_BUILD_ENV) go build \
		-ldflags="$(GO_LDFLAGS)" \
		-o $(BIN_DIR)/$(SERVER_OUTPUT) \
		./cmd/server/
	@echo ">>> 服务端版构建完成：$(BIN_DIR)/$(SERVER_OUTPUT)"
	@echo ">>> 使用方式：./$(BIN_DIR)/$(SERVER_OUTPUT) --addr :8080"

# 内部辅助目标：供 CI / release 复用，不建议手工直接调用
build-server-target: SERVER_OUTPUT := $(SERVER_NAME)-$(GOOS)-$(GOARCH)
build-server-target: prepare-build-metadata prepare-server-assets
	@echo ">>> [3/3] 编译目标平台服务端二进制 ($(GOOS)/$(GOARCH))..."
	mkdir -p $(BIN_DIR)
	$(GO_BUILD_ENV) go build \
		-ldflags="$(GO_LDFLAGS)" \
		-o $(BIN_DIR)/$(SERVER_OUTPUT) \
		./cmd/server/
	@echo ">>> 完成：$(BIN_DIR)/$(SERVER_OUTPUT)"

# ── 交叉编译服务端（Linux amd64，适合 CI/Docker 部署）────────────
build-server-linux: GOOS := linux
build-server-linux: GOARCH := amd64
build-server-linux: build-server-target

# ── 同时构建两种模式 ─────────────────────────────────────────────
build-all: build-desktop build-server
	@echo ">>> 全部构建完成"

# ── 开发模式 ─────────────────────────────────────────────────────
dev:
	@echo ">>> 启动桌面开发模式（wails dev）..."
	$(BUILD_META_CMD) -mode sync
	wails dev -ldflags "$(LDFLAGS)"

dev-server:
	@echo ">>> 启动服务端开发模式..."
	@echo ">>> 请在另一个终端运行：npm run dev:server --prefix $(FRONTEND)"
	$(BUILD_META_CMD) -mode sync
	go run -ldflags "$(LDFLAGS)" ./cmd/server/ --addr :8080

# ── 清理 ─────────────────────────────────────────────────────────
clean:
	@echo ">>> 清理构建产物..."
	rm -rf $(BIN_DIR)
	rm -rf build/bin
	rm -rf $(FRONTEND)/dist
	rm -rf $(FRONTEND)/dist-server
	rm -rf cmd/server/dist
	# 保留 .gitkeep 占位文件
	mkdir -p cmd/server/dist && touch cmd/server/dist/.gitkeep
	@echo ">>> 清理完成"
