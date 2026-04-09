$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Get-EmbeddedNpm {
  $embedded = Join-Path $root "runtime\nodejs\npm.cmd"
  if (Test-Path $embedded) {
    return $embedded
  }

  return "npm"
}

function Invoke-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )

  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Cyan
  & $Action
}

$npmCmd = Get-EmbeddedNpm

if (-not (Test-Path ".env")) {
  Copy-Item ".env.mysql.example" ".env"
  Write-Host "已根据 .env.mysql.example 生成 .env，请按你的 MySQL 实际账号确认配置。" -ForegroundColor Yellow
}

if (-not (Test-Path "node_modules")) {
  Invoke-Step "安装依赖" { & $npmCmd install }
} else {
  Write-Host "已检测到内置依赖，跳过 npm install。" -ForegroundColor Green
}

Invoke-Step "生成 Prisma Client" { & $npmCmd run prisma:generate }
Invoke-Step "推送 MySQL 表结构" { & $npmCmd run prisma:push }
Invoke-Step "导入演示数据" { & $npmCmd run db:seed }
Invoke-Step "构建前端资源" { & $npmCmd run build }

Write-Host ""
Write-Host "MySQL 环境初始化完成。" -ForegroundColor Green
Write-Host "展示模式启动：start-app.bat" -ForegroundColor Green
Write-Host "开发模式启动：start-dev.bat" -ForegroundColor Green
