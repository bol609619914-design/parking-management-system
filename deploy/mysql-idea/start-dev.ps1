$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-EmbeddedNpm {
  $embedded = Join-Path $root "runtime\nodejs\npm.cmd"
  if (Test-Path $embedded) {
    return $embedded
  }

  return "npm"
}

$npmCmd = Get-EmbeddedNpm
$quotedNpm = '"' + $npmCmd + '"'

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; & $quotedNpm run dev:api"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; & $quotedNpm run dev"

Write-Host "开发模式已启动：" -ForegroundColor Green
Write-Host "- 后端：http://127.0.0.1:5050" -ForegroundColor Green
Write-Host "- 前端：http://127.0.0.1:5173" -ForegroundColor Green
