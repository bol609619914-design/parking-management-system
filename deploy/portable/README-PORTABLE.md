# ParkSphere 单机交付包

这个目录用于部署到一台没有预装 Node.js 和 MySQL 的 Windows 电脑。

## 使用方式

1. 双击 `start-portable.bat`
2. 等待浏览器自动打开系统页面
3. 使用完成后双击 `stop-portable.bat`

## 数据库说明

- 默认数据库为 SQLite
- 数据库文件位置：`app/server/data/parking.db`
- 可以直接使用 IntelliJ IDEA Ultimate、DataGrip、DBeaver 或 DB Browser for SQLite 打开查看和修改
- 如需恢复初始演示数据，双击 `reset-demo-data.bat`

## 演示账号

- 管理员：`admin@parksphere.local` / `Admin@123`
- 商户端：`merchant@parksphere.local` / `Merchant@123`
- 用户端：`user@parksphere.local` / `User@123`

## 适用场景

- 毕业设计答辩
- 客户试用
- 单机演示
- 无数据库服务环境下的本地部署

## 提示

- 首次启动会自动创建 SQLite 数据库
- 如果 5050 端口被占用，启动脚本会自动切换到其他预设端口
- 这个交付包适合本地单机使用，正式生产环境仍建议使用独立服务器和数据库
