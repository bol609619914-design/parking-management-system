$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $root "app"
$nodeExe = Join-Path $root "runtime\nodejs\node.exe"
$stateDir = Join-Path $root ".runtime"
$logsDir = Join-Path $root "logs"
$pidFile = Join-Path $stateDir "server.pid"
$portFile = Join-Path $stateDir "server.port"
$launchEnvFile = Join-Path $stateDir "launch.env"
$stdoutLog = Join-Path $logsDir "server.out.log"
$stderrLog = Join-Path $logsDir "server.err.log"

New-Item -ItemType Directory -Force -Path $stateDir, $logsDir | Out-Null

function Get-ManagedProcess {
  if (-not (Test-Path $pidFile)) {
    return $null
  }

  $pidValue = Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $pidValue) {
    return $null
  }

  return Get-Process -Id $pidValue -ErrorAction SilentlyContinue
}

function Get-StoredPort {
  if (-not (Test-Path $portFile)) {
    return "5050"
  }

  $savedPort = Get-Content $portFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $savedPort) {
    return "5050"
  }

  return "$savedPort"
}

function Get-FreePort {
  $candidates = @(5050, 5051, 5080, 5090)

  foreach ($candidate in $candidates) {
    $busy = Get-NetTCPConnection -LocalPort $candidate -ErrorAction SilentlyContinue
    if (-not $busy) {
      return "$candidate"
    }
  }

  throw "No free port found. Please close any process using 5050, 5051, 5080, or 5090."
}

$existing = Get-ManagedProcess
if ($existing) {
  $runningPort = Get-StoredPort
  $runningUrl = "http://127.0.0.1:" + $runningPort
  Start-Process $runningUrl
  Write-Host "ParkSphere is already running. Browser opened."
  exit 0
}

if (-not (Test-Path $nodeExe)) {
  throw "Embedded Node runtime not found: $nodeExe"
}

$port = Get-FreePort
$launchEnv = @(
  "PORT=$port"
  "APP_STORAGE=sqlite"
  "SQLITE_DB_PATH=./server/data/parking.db"
  "JWT_SECRET=parksphere-portable-secret"
  ""
) -join "`n"

Set-Content -Path $launchEnvFile -Value $launchEnv

$process = Start-Process -FilePath $nodeExe `
  -ArgumentList @("--env-file=$launchEnvFile", "server/index.js") `
  -WorkingDirectory $appDir `
  -RedirectStandardOutput $stdoutLog `
  -RedirectStandardError $stderrLog `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $pidFile -Value $process.Id
Set-Content -Path $portFile -Value $port

$healthUrl = "http://127.0.0.1:" + $port + "/api/health"
$ready = $false

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
  }
}

if (-not $ready) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  Remove-Item $portFile -Force -ErrorAction SilentlyContinue
  throw "Service failed to start. Check log: $stderrLog"
}

$startUrl = "http://127.0.0.1:" + $port
Start-Process $startUrl
Write-Host "ParkSphere started at $startUrl"
