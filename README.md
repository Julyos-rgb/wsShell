# wsShell

<p align="center">
  <strong>轻量级桌面 SSH 客户端</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.25+-00ADD8?style=flat&logo=go" alt="Go Version" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/Wails-v2-3F485A?style=flat" alt="Wails" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform" />
</p>

wsShell 是一个基于 [Wails v2](https://wails.io/) 构建的轻量级桌面 SSH 客户端，使用 Go 后端 + React 前端。提供 SSH 终端、SFTP 文件管理和 VNC 远程桌面功能，帮助开发者高效管理多台服务器。

## ✨ 功能特性

### SSH 终端
- 多会话管理，支持同一服务器同时打开多个终端标签
- 基于 xterm.js 的全功能终端模拟（256色、链接识别）
- 支持密码认证和私钥认证
- 自适应窗口大小，终端随窗口缩放

### SFTP 文件管理
- 双栏文件浏览器（本地 / 远程）
- 拖拽上传 / 下载
- 文件传输断点续传
- 传输进度实时显示

### VNC 远程桌面
- 集成 noVNC 查看器
- 通过 SSH 隧道安全连接远程 VNC 服务
- 全屏模式、连接状态显示

### 服务器管理
- 服务器分组与收藏
- 凭证加密存储（AES-256-GCM）
- 快速连接 / 断开

## 📸 截图

> TODO: 添加应用截图

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | [Wails v2](https://wails.io/) (Go + WebView) |
| 后端 | Go 1.25+ |
| 前端 | React 18, TypeScript, TailwindCSS |
| 终端 | [xterm.js](https://xtermjs.org/) |
| VNC | [noVNC](https://novnc.com/) |
| 状态管理 | [Zustand](https://zustand.docs.pmnd.rs/) |
| SSH | [golang.org/x/crypto/ssh](https://pkg.go.dev/golang.org/x/crypto/ssh) |
| SFTP | [pkg/sftp](https://github.com/pkg/sftp) |
| 数据库 | SQLite ([modernc.org/sqlite](https://gitlab.com/cznic/sqlite)) |

## 📁 项目结构

```
wsShell/
├── app.go                          # Wails 应用绑定
├── main.go                         # 入口
├── wails.json                      # Wails 配置
├── internal/
│   ├── ssh/ssh_service.go          # SSH 连接与会话管理
│   ├── sftp/sftp_manager.go        # SFTP 文件传输
│   ├── config/config_manager.go    # 服务器配置管理
│   ├── crypto/encryptor.go         # AES-256-GCM 加密
│   ├── store/                      # SQLite 存储层
│   │   ├── sqlite.go               # 数据库连接
│   │   ├── migrations.go           # 数据库迁移
│   │   └── server_repository.go    # Repository 接口
│   └── vnc/proxy.go                # VNC SSH 隧道代理
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Terminal.tsx        # SSH 终端
│   │   │   ├── FileManager.tsx     # SFTP 文件管理
│   │   │   ├── VncViewer.tsx       # VNC 远程桌面
│   │   │   ├── Sidebar.tsx         # 服务器列表
│   │   │   ├── AddServerDialog.tsx # 添加服务器对话框
│   │   │   └── StatusBar.tsx       # 状态栏
│   │   ├── stores/ui.ts            # Zustand 状态管理
│   │   └── types/index.ts          # TypeScript 类型
│   └── wailsjs/                    # Wails 自动生成的绑定
└── build/                          # 构建资源（图标等）
```

## 🚀 快速开始

### 环境要求

- **Go** 1.18+
- **Node.js** 16+
- **Wails CLI** v2

### 安装 Wails CLI

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

### 克隆项目

```bash
git clone https://github.com/Julyos-rgb/wsShell.git
cd wsShell
```

### 安装前端依赖

```bash
cd frontend && npm install && cd ..
```

### 开发模式

```bash
wails dev
```

### 构建生产版本

```bash
wails build
```

构建产物位于 `build/bin/` 目录。

## 🔧 开发指南

### 后端

后端代码位于 `internal/` 目录，按功能模块划分。每个服务都需要实现 `SetContext(ctx context.Context)` 方法以支持 Wails 事件系统。

添加新服务的步骤：
1. 在 `internal/{service}/` 下创建服务
2. 在 `main.go` 的 `Bind[]` 中注册
3. 前端通过 Wails 绑定调用

### 前端

前端代码位于 `frontend/src/`，使用 React + TypeScript + TailwindCSS。

- **组件**: `frontend/src/components/`
- **状态管理**: Zustand (`frontend/src/stores/`)
- **类型定义**: `frontend/src/types/`

### 通信模式

| 模式 | 用途 | 示例 |
|------|------|------|
| Wails Bindings | 请求-响应调用 | `SSHService.Connect()` |
| Wails Events | 服务端→客户端流 | `ssh:{id}:stdout` |

## 🤝 参与贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 提交规范

- `feat:` 新功能
- `fix:` 修复 Bug
- `refactor:` 代码重构
- `docs:` 文档更新
- `chore:` 构建/工具变更

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。

Copyright (c) 2026 Julyos-rgb
