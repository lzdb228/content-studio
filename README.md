# 微信公众号内容工厂 · WeChat Content Factory

> 一站式桌面工具：对标采集 → 风格蒸馏 → AI 二创 → 一键发布到微信公众号草稿箱

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 19 + TypeScript + Tailwind CSS v4 |
| 状态管理 | Zustand |
| 路由 | React Router v7 |
| 桥接层 | FastAPI (Python) |
| 数据源 | 飞书多维表格（微信公众号内容工厂） |
| 认证 | xingliu-plus-uniapp (Ruoyi) |

## 快速开始

### 1. 环境要求

- **Node.js** ≥ 20
- **Rust** ≥ 1.80（[安装](https://rustup.rs)）
- **Python** ≥ 3.10
- **系统依赖**：[Tauri 前置条件](https://tauri.app/start/prerequisites/)

### 2. 安装

```bash
cd products/content-studio

# 前端依赖
NODE_ENV=development npm install

# Python sidecar 依赖
pip install -r sidecar/requirements.txt
```

### 3. 开发模式（仅前端，无需 Rust）

```bash
# 使用 mock 数据运行前端
NODE_ENV=development npm run dev
# 打开 http://localhost:1420
# 登录用任意用户名/密码（mock 模式）
```

### 4. 完整开发模式（含 Tauri）

```bash
# 启动 sidecar
cd sidecar && python3 -m uvicorn main:app --port 5200 &

# 启动 Tauri 开发
NODE_ENV=development npm run tauri dev
```

### 5. 打包

```bash
NODE_ENV=development npm run tauri build
# macOS → src-tauri/target/release/bundle/dmg/
# Windows → src-tauri/target/release/bundle/msi/
# Linux → src-tauri/target/release/bundle/deb/
```

### 6. 原型部署（双轨）

原型同时支持 GitHub Pages + 自有服务器：

| 环境 | 门户 | 内容工坊 |
|------|------|------|
| **GitHub Pages** | https://lzdb228.github.io/content-studio/ | 点击卡片进入 |
| **248 服务器** | http://47.98.184.248:8889/ | 点击卡片进入 |

```bash
# 构建原型（base: "./" 相对路径 + HashRouter）
NODE_ENV=development npm run build

# 部署到 248
./deploy-prototype.sh

# 部署到 GitHub Pages
python3 deploy_gh_pages.py
```

## 项目结构

```
content-studio/
├── src/                    # React 前端
│   ├── pages/
│   │   ├── LoginPage.tsx       # 登录页
│   │   ├── DashboardPage.tsx   # 对标管理
│   │   ├── CollectPage.tsx     # 一键采集
│   │   ├── LibraryPage.tsx     # 素材库
│   │   └── SettingsPage.tsx    # 设置
│   ├── stores/index.ts         # Zustand 状态 (auth + settings)
│   ├── lib/api.ts              # API 桥接层 (Tauri invoke + mock 降级)
│   └── App.tsx                 # 路由 + 侧边栏
├── src-tauri/              # Tauri Rust 后端
│   └── src/lib.rs              # 7 个 Tauri commands
├── sidecar/                # FastAPI Python 桥接
│   ├── main.py                 # REST API 端点
│   └── requirements.txt
├── package.json
└── vite.config.ts
```

## API 端点

### Tauri Commands (Rust → 前端)

| Command | 用途 |
|---------|------|
| `login` | xingliu 认证 |
| `store_secret` / `get_secret` | 密钥加密存储 |
| `get_feishu_tables` | 飞书表列表 |
| `get_feishu_records` | 飞书记录查询 |
| `start_sidecar` | 启动 FastAPI |
| `sync_all_accounts` | 触发全部采集 |

### FastAPI Sidecar (Rust → Python)

| 端点 | 用途 |
|------|------|
| `GET /api/health` | 健康检查 |
| `POST /api/collect/sync` | 全部对标账号采集 |
| `POST /api/collect/sync/{fakeid}` | 单账号采集 |

## Mock 开发模式

`lib/api.ts` 通过 `window.__TAURI_INTERNALS__` 自动检测环境：
- **Tauri 环境**：`@tauri-apps/api invoke` 调 Rust backend
- **开发环境**：内置 mock 数据（3 账号 + 5 文章 + 6 飞书表）

前端可完全独立开发，无需 Rust toolchain。

## 打包产物

| 平台 | 格式 | 大小 |
|------|------|------|
| macOS | `.dmg` | ~15MB |
| Windows | `.msi` | ~12MB |
| Linux | `.deb` / `.AppImage` | ~10MB |

## 相关链接

- Linear: [XIN-36](https://linear.app/xingliu/issue/XIN-36/)
- 飞书模板：星核知识库 → 微信公众号内容工厂 副本
- 设计文档：`workspace/engineer/personal/wechat-content-studio/`
