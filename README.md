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
  <a href="https://zread.ai/Julyos-rgb/wsShell"><img src="https://img.shields.io/badge/Ask_Zread-_.svg?style=flat&color=00b0aa&labelColor=000000&logo=data%3Aimage%2Fsvg%2Bxml%3Bbase64%2CPHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTQuOTYxNTYgMS42MDAxSDIuMjQxNTZDMS44ODgxIDEuNjAwMSAxLjYwMTU2IDEuODg2NjQgMS42MDE1NiAyLjI0MDFWNC45NjAxQzEuNjAxNTYgNS4zMTM1NiAxLjg4ODEgNS42MDAxIDIuMjQxNTYgNS42MDAxSDQuOTYxNTZDNS4zMTUwMiA1LjYwMDEgNS42MDE1NiA1LjMxMzU2IDUuNjAxNTYgNC45NjAxVjIuMjQwMUM1LjYwMTU2IDEuODg2NjQgNS4zMTUwMiAxLjYwMDEgNC45NjE1NiAxLjYwMDFaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00Ljk2MTU2IDEwLjM5OTlIMi4yNDE1NkMxLjg4ODEgMTAuMzk5OSAxLjYwMTU2IDEwLjY4NjQgMS42MDE1NiAxMS4wMzk5VjEzLjc1OTlDMS42MDE1NiAxNC4xMTM0IDEuODg4MSAxNC4zOTk5IDIuMjQxNTYgMTQuMzk5OUg0Ljk2MTU2QzUuMzE1MDIgMTQuMzk5OSA1LjYwMTU2IDE0LjExMzQgNS42MDE1NiAxMy43NTk5VjExLjAzOTlDNS42MDE1NiAxMC42ODY0IDUuMzE1MDIgMTAuMzk5OSA0Ljk2MTU2IDEwLjM5OTlaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik0xMy43NTg0IDEuNjAwMUgxMS4wMzg0QzEwLjY4NSAxLjYwMDEgMTAuMzk4NCAxLjg4NjY0IDEwLjM5ODQgMi4yNDAxVjQuOTYwMUMxMC4zOTg0IDUuMzEzNTYgMTAuNjg1IDUuNjAwMSAxMS4wMzg0IDUuNjAwMUgxMy43NTg0QzE0LjExMTkgNS42MDAxIDE0LjM5ODQgNS4zMTM1NiAxNC4zOTg0IDQuOTYwMVYyLjI0MDFDMTQuMzk4NCAxLjg4NjY0IDE0LjExMTkgMS42MDAxIDEzLjc1ODQgMS42MDAxWiIgZmlsbD0iI2ZmZiIvPgo8cGF0aCBkPSJNNCAxMkwxMiA0TDQgMTJaIiBmaWxsPSIjZmZmIi8%2BCjxwYXRoIGQ9Ik00IDEyTDEyIDQiIHN0cm9rZT0iI2ZmZiIgc3Ryb2tlLXdpZHRoPSIxLjUiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPgo8L3N2Zz4K&logoColor=ffffff" alt="Ask Zread" /></a>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> &nbsp;|&nbsp;
  <a href="#-技术架构">技术架构</a> &nbsp;|&nbsp;
  <a href="#-快速开始">快速开始</a> &nbsp;|&nbsp;
  <a href="#-开发指南">开发指南</a> &nbsp;|&nbsp;
  <a href="#-参与贡献">参与贡献</a>
</p>

---

wsShell 是一个基于 [Wails v2](https://wails.io/) 构建的轻量级桌面 SSH 客户端，使用 **Go 后端 + React 前端**架构。提供 SSH 终端、SFTP 文件管理和 VNC 远程桌面功能，帮助开发者高效管理多台服务器。

## ✨ 功能特性

### SSH 终端
- 多会话管理，支持同一服务器同时打开多个终端标签
- 基于 [xterm.js](https://xtermjs.org/) 的全功能终端模拟（256色、链接识别）
- 支持密码认证和私钥认证
- 自适应窗口大小，终端随窗口缩放
- 10000 行回滚缓冲区

### SFTP 文件管理
- 双栏文件浏览器（本地 / 远程）
- 拖拽上传 / 下载
- 文件传输断点续传
- 传输进度实时显示
- 远程文件增删改查、目录创建与重命名

### VNC 远程桌面
- 集成 [noVNC](https://novnc.com/) 查看器
- 通过 SSH 隧道安全连接远程 VNC 服务
- 全屏模式、连接状态显示

### 服务器管理
- 服务器分组与收藏
- 凭证加密存储（AES-256-GCM）
- 快速连接 / 断开
- 标签系统与搜索过滤

## 📸 截图

> TODO: 添加应用截图

## 🛠️ 技术架构

### 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                 Desktop Application                       │
│                   (Wails Runtime)                         │
├─────────────────────┬────────────────────────────────────┤
│     Go Backend      │     React Frontend (embedded)      │
│                     │                                     │
│  ┌───────────────┐  │  ┌──────────────────────────────┐  │
│  │  SSHService   │◄─┼──│  Terminal (xterm.js)         │  │
│  └───────────────┘  │  └──────────────────────────────┘  │
│  ┌───────────────┐  │  ┌──────────────────────────────┐  │
│  │  SFTPManager  │◄─┼──│  FileManager (双栏浏览器)     │  │
│  └───────────────┘  │  └──────────────────────────────┘  │
│  ┌───────────────┐  │  ┌──────────────────────────────┐  │
│  │   VNC Proxy   │◄─┼──│  VncViewer (noVNC)           │  │
│  └───────────────┘  │  └──────────────────────────────┘  │
│  ┌───────────────┐  │  ┌──────────────────────────────┐  │
│  │ ConfigManager │◄─┼──│  Sidebar / StatusBar         │  │
│  └───────────────┘  │  └──────────────────────────────┘  │
│  ┌───────────────┐  │  ┌──────────────────────────────┐  │
│  │  Encryptor    │  │  │  Zustand State Management    │  │
│  │  (AES-256)    │  │  └──────────────────────────────┘  │
│  └───────────────┘  │                                     │
│  ┌───────────────┐  │                                     │
│  │ SQLite Store  │  │                                     │
│  └───────────────┘  │                                     │
├─────────────────────┴────────────────────────────────────┤
│          Wails Bindings (Request → Response)              │
│          Wails Events   (Server → Client Stream)          │
└──────────────────────────────────────────────────────────┘
```

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面框架 | [Wails v2](https://wails.io/) | Go + WebView，无需打包 Chromium |
| 后端 | Go 1.25+ | 网络编程、并发处理 |
| 前端 | React 18, TypeScript, TailwindCSS | 组件化 UI |
| 终端模拟 | [xterm.js](https://xtermjs.org/) | 全功能终端渲染 |
| VNC | [noVNC](https://novnc.com/) | Web 端 VNC 客户端 |
| 状态管理 | [Zustand](https://zustand.docs.pmnd.rs/) | 轻量级 React 状态管理 |
| SSH | [golang.org/x/crypto/ssh](https://pkg.go.dev/golang.org/x/crypto/ssh) | SSH 协议实现 |
| SFTP | [pkg/sftp](https://github.com/pkg/sftp) | SFTP 文件传输 |
| 数据库 | SQLite ([modernc.org/sqlite](https://gitlab.com/cznic/sqlite)) | 纯 Go 实现，无需 CGO |

### 通信模式

**Bindings（请求-响应）** — 前端直接调用 Go 方法：

```typescript
// 前端
const result = await Connect({ host: "192.168.1.100", port: 22, username: "root", password: "xxx" })
```

**Events（服务端推送）** — Go 主动向前端推送数据流：

```go
// Go 后端 — 终端输出实时推送
runtime.EventsEmit(s.Ctx, "ssh:"+sessionID+":stdout", data)
```

```typescript
// 前端 — 订阅终端输出
EventsOn(`ssh:${sessionId}:stdout`, (data) => { term.write(data) })
```

## 📁 项目结构

```
wsShell/
├── main.go                         # 应用入口，Wails 配置与 Bind 注册
├── app.go                          # App 结构体，服务编排与依赖注入
├── wails.json                      # Wails 项目配置
│
├── internal/                       # Go 后端（按功能模块划分）
│   ├── ssh/
│   │   └── ssh_service.go          # SSH 连接与会话管理（多标签、PTY、流式IO）
│   ├── sftp/
│   │   └── sftp_manager.go         # SFTP 文件传输（上传/下载/断点续传）
│   ├── config/
│   │   └── config_manager.go       # 服务器配置 CRUD（加密存储）
│   ├── crypto/
│   │   └── encryptor.go            # AES-256-GCM 加解密，Master Key 管理
│   ├── store/
│   │   ├── sqlite.go               # 数据库连接（WAL 模式，单例）
│   │   ├── migrations.go           # 自动建表迁移
│   │   └── server_repository.go    # Repository 接口实现
│   └── vnc/
│       └── proxy.go                # VNC WebSocket 代理（SSH 隧道转发）
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Terminal.tsx         # xterm.js 终端组件（多标签、自适应）
│   │   │   ├── FileManager.tsx      # SFTP 双栏文件管理器
│   │   │   ├── VncViewer.tsx        # noVNC 远程桌面
│   │   │   ├── Sidebar.tsx          # 服务器列表侧栏
│   │   │   ├── AddServerDialog.tsx  # 添加/编辑服务器对话框
│   │   │   └── StatusBar.tsx        # 底部状态栏
│   │   ├── stores/
│   │   │   └── ui.ts               # Zustand 状态管理（4 个独立 Store）
│   │   ├── types/
│   │   │   └── index.ts            # TypeScript 类型定义
│   │   ├── App.tsx                 # 根组件（标签页路由）
│   │   └── main.tsx                # 入口
│   └── wailsjs/                    # Wails 自动生成的绑定（勿手动编辑）
│
└── build/                          # 构建资源（图标、manifest）
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

`wails dev` 同时启动 Go 后端和 Vite 前端开发服务器，支持双向热重载。

### 构建生产版本

```bash
wails build
```

构建产物位于 `build/bin/` 目录，为独立可执行文件，无需安装运行时。

## 🔧 开发指南

### 后端

后端代码位于 `internal/` 目录，按功能模块划分。每个服务都需要持有 `context.Context` 以支持 Wails 事件系统。

添加新服务的步骤：

1. 在 `internal/{service}/` 下创建服务，实现公开方法
2. 在 [main.go](main.go) 的 `Bind[]` 中注册服务对象
3. Wails 自动生成 TypeScript 绑定，前端直接调用

所有后端方法使用统一的请求/响应结构体：

```go
type ConnectRequest struct {
    Host     string `json:"host"`
    Port     int    `json:"port"`
    Username string `json:"username"`
    // ...
}

type ConnectResponse struct {
    Success   bool   `json:"success"`
    Error     string `json:"error,omitempty"`
    SessionID string `json:"sessionId,omitempty"`
}
```

### 前端

前端代码位于 `frontend/src/`，使用 React + TypeScript + TailwindCSS。

- **组件**: `frontend/src/components/`
- **状态管理**: Zustand (`frontend/src/stores/`) — 4 个独立 Store：
  - `useUIStore` — UI 状态（当前标签、主题、对话框）
  - `useConnectionStore` — 连接状态（服务器列表、会话映射）
  - `useTransferStore` — 文件传输状态（任务列表、进度）
  - `useTerminalTabStore` — 终端标签状态（多标签管理）
- **类型定义**: `frontend/src/types/`

### 安全设计

- **凭证加密**: 所有密码、私钥使用 AES-256-GCM 加密后存储到 SQLite
- **Master Key**: 运行时自动生成 32 字节密钥，存储于用户本地目录：
  - Windows: `%LOCALAPPDATA%/wsShell/master.key`
  - macOS/Linux: `~/.wsShell/keys/master.key`
- **数据库**: SQLite 使用 WAL 模式，数据存储于 `~/.wsShell/wsShell.db`

### 关键设计模式

| 模式 | 应用场景 | 代码位置 |
|------|----------|----------|
| 单例模式 | SQLite 数据库连接 (`sync.Once`) | `internal/store/sqlite.go` |
| Repository | 数据访问层抽象接口 | `internal/store/server_repository.go` |
| 依赖注入 | VNC Proxy 注入 SSH Provider | `app.go` |
| 观察者模式 | Wails Events 事件订阅 | 全项目 |
| Goroutine + Channel | SSH stdin 非阻塞写入 | `internal/ssh/ssh_service.go` |
| 并发安全 | `sync.RWMutex` 保护共享状态 | SSH、SFTP、VNC 服务 |

## 🤝 参与贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 提交规范

| 前缀 | 说明 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | 修复 Bug |
| `refactor:` | 代码重构 |
| `docs:` | 文档更新 |
| `chore:` | 构建/工具变更 |
| `style:` | 代码格式调整 |

## 📄 开源许可

本项目基于 [MIT License](LICENSE) 开源。

Copyright (c) 2026 Julyos-rgb
