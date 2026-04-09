$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Get-EmbeddedNode {
  $embedded = Join-Path $root "runtime\nodejs\node.exe"
  if (Test-Path $embedded) {
    return $embedded
  }

  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "未找到可用的 Node 运行时，请先使用完整交付包或安装 Node.js。"
}

if (-not (Test-Path ".env")) {
  throw "未找到 .env，请先运行 setup-mysql.bat"
}

$nodeExe = Get-EmbeddedNode
Write-Host "正在启动后端服务，浏览器访问 http://127.0.0.1:5050" -ForegroundColor Cyan
& $nodeExe "server/index.js"
