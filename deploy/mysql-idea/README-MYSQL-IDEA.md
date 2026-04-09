# 停车场管理系统 MySQL 交付说明

这套交付包面向 `IntelliJ IDEA + MySQL` 场景，适合毕业设计答辩、老师检查数据库、朋友电脑本地部署和二次开发。

## 交付包特点

- 自带前端构建产物 `dist`
- 自带完整源码，方便 IDEA 打开和二次开发
- 自带 `node_modules`
- 自带 Node 运行时，不要求对方另外安装 Node.js
- 使用本机 MySQL，方便老师通过 IDEA 直接查看数据库

说明：

- 这是一套 `MySQL 全依赖交付包`
- 包内已经带了 Node 和依赖，但 `MySQL` 仍然需要对方电脑本地已安装并运行

## 一、建议部署路径

解压到英文路径，例如：

```text
D:\parking-management-system-mysql
```

不要放到过深的中文路径、网盘同步目录或系统权限很严的目录。

## 二、环境要求

- Windows 10 / 11
- MySQL 8.0 或更高版本
- IntelliJ IDEA Ultimate

如果只是要查看数据库，也可以使用：

- DataGrip
- DBeaver
- Navicat for MySQL

## 三、创建数据库

包内已经附带：

- `mysql-init.sql`

### 方式 1：在 MySQL 命令行执行

```sql
source mysql-init.sql;
```

### 方式 2：在 IDEA 里执行

1. 打开 IDEA。
2. 打开 `View > Tool Windows > Database`。
3. 点击 `+`。
4. 选择 `Data Source > MySQL`。
5. 按下面连接：

```text
Host: 127.0.0.1
Port: 3306
User: root
Password: 123456
```

6. 连接成功后，打开 `mysql-init.sql` 并执行。

执行完成后会创建数据库：

```text
parking_management_system
```

## 四、配置 .env

首次使用时，把：

```text
.env.mysql.example
```

复制为：

```text
.env
```

默认示例已经写好：

```env
APP_STORAGE="mysql"
DATABASE_URL="mysql://root:123456@127.0.0.1:3306/parking_management_system?allowPublicKeyRetrieval=true&ssl=false"
JWT_SECRET="parksphere-dev-secret"
PORT=5050
```

如果对方电脑的 MySQL 账号、密码、端口不同，只改 `DATABASE_URL` 即可。

## 五、初始化项目

直接双击：

```text
setup-mysql.bat
```

它会自动执行：

1. 生成 Prisma Client
2. 推送 MySQL 表结构
3. 导入演示数据
4. 构建前端资源

如果包里已经自带 `node_modules`，脚本会自动跳过 `npm install`。

## 六、启动系统

### 展示模式

双击：

```text
start-app.bat
```

启动后访问：

- [http://127.0.0.1:5050](http://127.0.0.1:5050)

这个模式适合答辩、老师检查和日常演示，因为后端会直接托管前端打包结果。

### 开发模式

双击：

```text
start-dev.bat
```

会打开两个窗口：

- 后端接口：[http://127.0.0.1:5050](http://127.0.0.1:5050)
- 前端页面：[http://127.0.0.1:5173](http://127.0.0.1:5173)

## 七、如何在 IDEA 查看数据库

1. 在 IDEA 打开 `Database` 窗口。
2. 新建 `MySQL` 数据源。
3. 输入下面信息：

```text
Host: 127.0.0.1
Port: 3306
Schema: parking_management_system
User: root
Password: 123456
```

4. 点击测试连接。
5. 成功后展开：

```text
Schemas > parking_management_system > Tables
```

你会看到这些主要表：

- `users`
- `spaces`
- `entries`
- `payments`
- `coupons`
- `user_portals`
- `ocr_snapshots`
- `applications`

在 IDEA 里可以直接：

- 表格查看记录
- 双击修改字段
- 新增记录
- 删除记录
- 执行 SQL

## 八、如何重置演示数据

如果你把数据库演示数据改乱了，双击：

```text
reset-mysql-demo-data.bat
```

它会重新向 MySQL 写入演示数据。

## 九、测试账号

| 角色 | 账号 | 密码 |
| --- | --- | --- |
| 管理员 | `admin@parksphere.local` | `Admin@123` |
| 商户端 | `merchant@parksphere.local` | `Merchant@123` |
| 用户端 | `user@parksphere.local` | `User@123` |

测试验证码：

- `13800138000` → `246810`
- `13900139000` → `135790`
- `13700137000` → `864209`

## 十、答辩建议流程

1. 在 IDEA 连接 MySQL，先展示数据库表结构。
2. 启动系统，登录管理员账号。
3. 演示看板、OCR、入场、出场、车位管理、计费配置。
4. 切换到用户端，演示预约、离场缴费、电子发票、月租续费。
5. 回到 IDEA，刷新 `entries`、`payments`、`user_portals` 等表，展示数据变化。

## 十一、常见问题

### 1. 双击脚本没反应

请先确认：

- MySQL 服务已启动
- `.env` 已配置好
- 杀毒软件没有拦截 PowerShell 脚本

### 2. 数据库连不上

优先检查：

- MySQL 是否运行在 `3306`
- `root / 123456` 是否正确
- 防火墙是否阻止本机端口

### 3. 页面打不开

展示模式看：

- [http://127.0.0.1:5050](http://127.0.0.1:5050)

开发模式看：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)
