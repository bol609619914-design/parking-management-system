# 停车场管理系统

一个基于 Vue 3 与 Express 的多角色停车场管理系统演示项目，覆盖管理员、商户端与车主端三类使用场景。项目内置认证门户、运营看板、出入管理、计费规则、车位管理、财务审计与车主服务中心，适合用于后台原型展示、课程作业、毕业设计和中小型系统演示。

## 项目预览

### 管理端
![管理端控制台](./docs/images/admin-console.png)

### 商户端
![商户端控制台](./docs/images/merchant-console.png)

### 车主端
![车主服务中心](./docs/images/user-portal.png)

## 核心能力

- 多角色登录体验：支持管理员、商户端、车主端进入各自界面
- 安全认证门户：账号密码登录、短信验证码登录、滑块验证、注册审核流程
- 实时运营看板：车位总量、剩余车位、设备状态、分区占用、告警提示
- 出入管理：OCR 识别模拟、白名单放行、黑名单拦截、入场建单、出场结算
- 计费引擎：免费时长、按时计费、阶梯计费、封顶金额、优惠券抵扣
- 车位管理：车位状态地图、预留、占用、释放、月租位切换
- 财务审计：收入汇总、订单流水、趋势报表
- 车主服务中心：预约车位、停车订单、优惠券、月租服务、离场缴费

## 技术栈

- 前端：Vue 3、Vite
- 后端：Express 5
- 认证：JWT、bcryptjs
- ORM / 数据访问：Prisma 7、`@prisma/adapter-mariadb`
- 数据存储：MySQL 8（支持保留 JSON 演示模式作为本地降级方案）

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
│  ├─ App.vue
│  └─ api.js
├─ .env.example
├─ LICENSE
├─ package.json
├─ prisma.config.ts
└─ README.md
```

## 快速开始

### 环境要求

- Node.js 20 及以上
- npm 10 及以上

### 安装依赖

```bash
npm install
```

### 配置数据库

如需启用 MySQL + Prisma，请先复制环境变量模板并填写你的数据库账号密码：

```bash
copy .env.example .env
```

推荐数据库连接串示例：

```env
DATABASE_URL="mysql://root:your_password@127.0.0.1:3306/parking_management_system"
```

首次接入 MySQL 时，执行以下命令初始化表结构并导入演示数据：

```bash
npm run prisma:generate
npm run prisma:push
npm run db:seed
```

### 启动后端

```bash
node server/index.js
```

默认地址为 [http://localhost:5050](http://localhost:5050)。

### 启动前端

```bash
npm run dev
```

默认地址为 [http://localhost:5173](http://localhost:5173)。

### 生产构建

```bash
npm run build
```

## 演示账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@parksphere.local` | `Admin@123` |
| 商户端 | `merchant@parksphere.local` | `Merchant@123` |
| 车主端 | `user@parksphere.local` | `User@123` |

短信验证码测试号码：

- `13800138000`：`246810`
- `13900139000`：`135790`
- `13700137000`：`864209`

## 功能模块

### 1. 认证与安全门户

- 账号密码登录
- 手机验证码快捷登录
- 记住我、忘记密码、注册审核流程
- 滑块验证交互演示

### 2. 管理端与商户端控制台

- 指挥中心总览
- 出入管理与 OCR 识别
- 计费规则配置
- 车位状态操作
- 财务统计与报表概览

### 3. 车主端服务中心

- 当前停车状态
- 预约车位提交与记录查看
- 离场缴费
- 优惠券与服务提醒
- 月租服务信息

## 主要接口

| 方法 | 地址 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 密码或验证码登录 |
| POST | `/api/auth/send-otp` | 获取演示验证码 |
| POST | `/api/auth/register` | 提交注册审核 |
| GET | `/api/dashboard` | 获取当前角色首页数据 |
| POST | `/api/ocr/recognize` | 模拟车牌识别 |
| POST | `/api/entries` | 创建入场记录 |
| POST | `/api/exits` | 创建出场结算 |
| PUT | `/api/billing/config` | 更新计费配置 |
| PUT | `/api/spaces/:code` | 更新车位状态 |
| POST | `/api/user/reservations` | 车主端提交预约 |
| POST | `/api/user/checkout` | 车主端离场缴费 |

## 开发说明

- 当前仓库支持两种数据模式：
- 未设置 `DATABASE_URL` 时，后端继续使用 `server/data/db.json`，适合演示与本地联调。
- 设置 `DATABASE_URL` 后，后端会切换到 MySQL + Prisma 存储层。
- `prisma/seed.js` 会把当前演示数据导入 MySQL，便于快速得到可登录、可预约、可缴费的初始化环境。
- 如需生产化部署，建议进一步接入真实 OCR 服务、对象存储、支付网关与更细粒度的权限体系。
- 认证密钥、数据库账号、第三方服务地址等敏感配置应统一放入环境变量。

## License

本项目采用 [MIT License](./LICENSE) 开源协议。
