# ================================================================
# EnvPilot Makefile
#
# 目标：
#   make build-desktop   桌面版（Wails，macOS/Windows/Linux GUI）
#   make build-server    服务端版（HTTP，可部署到服务器）
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
GIT_COMMIT  := $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
GIT_HEAD    := $(shell git rev-parse HEAD 2>/dev/null || echo)
GIT_TAG     := $(shell git describe --tags --abbrev=0 2>/dev/null || echo)
GIT_TAG_REF := $(shell if [ -n "$(GIT_TAG)" ]; then git rev-list -n 1 "$(GIT_TAG)" 2>/dev/null; fi)
APP_VERSION := $(shell if [ -n "$(GIT_TAG)" ] && [ "$(GIT_HEAD)" = "$(GIT_TAG_REF)" ]; then echo "$(GIT_TAG)"; else echo dev; fi)
LDFLAGS     := -s -w -X EnvPilot/pkg/buildinfo.Version=$(APP_VERSION) -X EnvPilot/pkg/buildinfo.Commit=$(GIT_COMMIT)
GO_LDFLAGS  := $(strip $(LDFLAGS) $(EXTRA_GO_LDFLAGS))
WAILS_BUILD_ARGS := -ldflags "$(GO_LDFLAGS)" -o $(DESKTOP_OUTPUT)
ifneq ($(strip $(DESKTOP_PLATFORM)),)
WAILS_BUILD_ARGS += -platform $(DESKTOP_PLATFORM)
endif

# ── 平台检测 ─────────────────────────────────────────────────────
GOOS   ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)

.PHONY: build-desktop build-server build-server-target build-server-linux build-all dev dev-server clean help prepare-server-assets

# ── 默认目标 ─────────────────────────────────────────────────────
help:
	@echo ""
	@echo "EnvPilot 构建脚本"
	@echo "=================================="
	@echo "  make build-desktop   构建桌面版（Wails）"
	@echo "  make build-server    构建服务端版（HTTP）"
	@echo "  make build-all       构建两种模式"
	@echo "  make dev             桌面开发模式（wails dev）"
	@echo "  make dev-server      服务端开发模式"
	@echo "  make clean           清理构建产物"
	@echo ""
	@echo "当前构建版本: $(APP_VERSION) ($(GIT_COMMIT))"
	@echo ""

# ── 桌面版构建（Wails）──────────────────────────────────────────
# 流程：npm run build（desktop 模式）→ wails build
build-desktop:
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
build-server: prepare-server-assets
	@echo ">>> [3/3] 编译 Go 服务端二进制..."
	mkdir -p $(BIN_DIR)
	GOOS=$(GOOS) GOARCH=$(GOARCH) go build \
		-ldflags="$(GO_LDFLAGS)" \
		-o $(BIN_DIR)/$(SERVER_OUTPUT) \
		./cmd/server/
	@echo ">>> 服务端版构建完成：$(BIN_DIR)/$(SERVER_OUTPUT)"
	@echo ">>> 使用方式：./$(BIN_DIR)/$(SERVER_OUTPUT) --addr :8080"

build-server-target: SERVER_OUTPUT := $(SERVER_NAME)-$(GOOS)-$(GOARCH)
build-server-target: prepare-server-assets
	@echo ">>> [3/3] 编译目标平台服务端二进制 ($(GOOS)/$(GOARCH))..."
	mkdir -p $(BIN_DIR)
	GOOS=$(GOOS) GOARCH=$(GOARCH) go build \
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
	wails dev -ldflags "$(LDFLAGS)"

dev-server:
	@echo ">>> 启动服务端开发模式..."
	@echo ">>> 请在另一个终端运行：npm run dev:server --prefix $(FRONTEND)"
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
