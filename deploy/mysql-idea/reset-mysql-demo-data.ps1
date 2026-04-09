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

if (-not (Test-Path ".env")) {
  throw "未找到 .env，请先运行 setup-mysql.bat"
}

$npmCmd = Get-EmbeddedNpm
& $npmCmd run db:seed
Write-Host "MySQL 演示数据已重置。" -ForegroundColor Green
