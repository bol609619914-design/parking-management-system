$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeStateDir = Join-Path $root ".runtime"
$pidFile = Join-Path $runtimeStateDir "server.pid"
$portFile = Join-Path $runtimeStateDir "server.port"

if (-not (Test-Path $pidFile)) {
  Write-Host "No running ParkSphere service."
  exit 0
}

$managedPid = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
if ($managedPid) {
  $process = Get-Process -Id $managedPid -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $managedPid -Force
  }
}

Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
Remove-Item $portFile -Force -ErrorAction SilentlyContinue
Write-Host "ParkSphere stopped."
