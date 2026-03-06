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

# ── 平台检测 ─────────────────────────────────────────────────────
GOOS   ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)

.PHONY: build-desktop build-server build-all dev dev-server clean help

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

# ── 桌面版构建（Wails）──────────────────────────────────────────
# 流程：npm run build（desktop 模式）→ wails build
build-desktop:
	@echo ">>> [1/2] 构建前端（桌面模式）..."
	npm run build --prefix $(FRONTEND)
	@echo ">>> [2/2] 构建 Wails 桌面应用..."
	wails build -o $(APP_NAME)
	@echo ">>> 桌面版构建完成：build/bin/$(APP_NAME)"

# ── 服务端版构建（HTTP）─────────────────────────────────────────
# 流程：npm run build:server → 复制到 cmd/server/dist → go build
build-server:
	@echo ">>> [1/3] 构建前端（服务端模式）..."
	npm run build:server --prefix $(FRONTEND)
	@echo ">>> [2/3] 复制前端资源到内嵌目录..."
	rm -rf cmd/server/dist && mkdir -p cmd/server/dist
	cp -r $(FRONTEND)/dist-server/. cmd/server/dist/
	@echo ">>> [3/3] 编译 Go 服务端二进制..."
	mkdir -p $(BIN_DIR)
	GOOS=$(GOOS) GOARCH=$(GOARCH) go build \
		-ldflags="-s -w" \
		-o $(BIN_DIR)/$(SERVER_NAME) \
		./cmd/server/
	@echo ">>> 服务端版构建完成：$(BIN_DIR)/$(SERVER_NAME)"
	@echo ">>> 使用方式：./$(BIN_DIR)/$(SERVER_NAME) --addr :8080"

# ── 交叉编译服务端（Linux amd64，适合 CI/Docker 部署）────────────
build-server-linux:
	@echo ">>> 交叉编译服务端（linux/amd64）..."
	npm run build:server --prefix $(FRONTEND)
	rm -rf cmd/server/dist && mkdir -p cmd/server/dist
	cp -r $(FRONTEND)/dist-server/. cmd/server/dist/
	mkdir -p $(BIN_DIR)
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build \
		-ldflags="-s -w" \
		-o $(BIN_DIR)/$(SERVER_NAME)-linux-amd64 \
		./cmd/server/
	@echo ">>> 完成：$(BIN_DIR)/$(SERVER_NAME)-linux-amd64"

# ── 同时构建两种模式 ─────────────────────────────────────────────
build-all: build-desktop build-server
	@echo ">>> 全部构建完成"

# ── 开发模式 ─────────────────────────────────────────────────────
dev:
	@echo ">>> 启动桌面开发模式（wails dev）..."
	wails dev

dev-server:
	@echo ">>> 启动服务端开发模式..."
	@echo ">>> 请在另一个终端运行：npm run dev:server --prefix $(FRONTEND)"
	go run ./cmd/server/ --addr :8080

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
