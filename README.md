# 停车场管理系统

一个基于 Vue 3、Vite、Express 和 Prisma 构建的多角色停车场管理系统，覆盖管理端、商户端和车主端三类场景。项目支持登录认证、实时看板、出入管理、计费引擎、车位管理、财务审计，以及车主预约、离场缴费、电子发票和月租续费等流程。

## 项目预览

### 管理端
![管理端控制台](./docs/images/admin-console.png)

### 商户端
![商户端控制台](./docs/images/merchant-console.png)

### 用户端
![用户端服务中心](./docs/images/user-portal.png)

## 核心能力

- 多角色认证：管理员、商户端、车主端三种账号可进入各自界面
- 安全门户：账号密码登录、手机验证码登录、滑块验证、找回密码、审批式注册
- 运营看板：总车位、剩余车位、设备在线状态、异常告警、营收与趋势分析
- 出入控制：OCR 识别、白名单自动放行、黑名单拦截、入场建单、出场结算
- 计费引擎：免费时长、按时计费、分段计费、封顶金额、优惠券抵扣
- 车位管理：车位状态地图、占用/释放、预约位、月租位切换
- 财务审计：营收汇总、订单流水、优惠抵扣、趋势看板
- 车主服务：预约车位、离场缴费、客服工单、电子发票申请、月租续费

## 技术栈

- 前端：Vue 3、Vite
- 后端：Express 5
- 认证：JWT、bcryptjs
- 数据层：Prisma 7、MariaDB Adapter、SQLite 单机模式
- 存储模式：MySQL / SQLite / JSON 回退模式

## 目录结构

```text
parking-management-system/
├─ docs/
│  └─ images/
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.js
├─ server/
│  ├─ data/
│  │  └─ db.json
│  ├─ lib/
│  └─ index.js
├─ src/
│  ├─ assets/
│  ├─ constants/
│  ├─ App.vue
│  └─ api.js
├─ deploy/
├─ scripts/
├─ .env.example
├─ LICENSE
├─ package.json
└─ prisma.config.ts
```

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm 10 或更高版本

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制环境变量模板：

```bash
copy .env.example .env
```

### 启动 MySQL 模式

在 `.env` 中配置数据库连接，例如：

```env
DATABASE_URL="mysql://root:your_password@127.0.0.1:3306/parking_management_system"
JWT_SECRET="parksphere-dev-secret"
PORT=5050
```

首次接入 MySQL 时执行：

```bash
npm run prisma:generate
npm run prisma:push
npm run db:seed
```

启动后端：

```bash
node server/index.js
```

启动前端：

```bash
npm run dev
```

默认访问地址：

- 前端：[http://localhost:5173](http://localhost:5173)
- 后端：[http://localhost:5050](http://localhost:5050)

### 启动 SQLite 单机模式

适合演示、交付和纯净电脑部署：

```bash
npm run db:sqlite:init
npm run start:sqlite
```

SQLite 数据库文件默认位于：

`server/data/parking.db`

## 演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@parksphere.local` | `Admin@123` |
| 商户端 | `merchant@parksphere.local` | `Merchant@123` |
| 用户端 | `user@parksphere.local` | `User@123` |

测试验证码：

- `13800138000` → `246810`
- `13900139000` → `135790`
- `13700137000` → `864209`

## 主要接口

| 方法 | 地址 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 密码或验证码登录 |
| POST | `/api/auth/send-otp` | 获取演示验证码 |
| POST | `/api/auth/reset-password` | 重置密码 |
| POST | `/api/auth/register` | 提交注册审核 |
| GET | `/api/dashboard` | 获取当前角色首页数据 |
| POST | `/api/ocr/recognize` | 模拟车牌识别 |
| POST | `/api/entries` | 创建入场记录 |
| POST | `/api/exits` | 创建出场结算 |
| PUT | `/api/billing/config` | 更新计费配置 |
| PUT | `/api/spaces/:code` | 更新车位状态 |
| POST | `/api/user/reservations` | 用户端提交预约 |
| POST | `/api/user/checkout` | 用户端离场缴费 |
| POST | `/api/user/support-tickets` | 用户端提交客服工单 |
| POST | `/api/user/invoices` | 用户端申请电子发票 |
| POST | `/api/user/membership/renewals` | 用户端月租续费 |

## 开发说明

- 未配置 `DATABASE_URL` 时，可使用 JSON 或 SQLite 模式快速启动
- 配置 `DATABASE_URL` 后，可切换到 MySQL + Prisma 持久化模式
- `prisma/seed.js` 会将当前演示数据导入 MySQL，便于快速得到可登录、可预约、可缴费的初始环境
- 交付到纯净 Windows 电脑时，推荐使用 `release/portable` 中的单机版

## License

本项目采用 [MIT License](./LICENSE) 开源协议。
