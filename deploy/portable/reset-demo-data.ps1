$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDataDir = Join-Path $root "app\server\data"
$dbFile = Join-Path $appDataDir "parking.db"
$dbWal = Join-Path $appDataDir "parking.db-wal"
$dbShm = Join-Path $appDataDir "parking.db-shm"
$seedFile = Join-Path $appDataDir "db.seed.json"
$jsonFile = Join-Path $appDataDir "db.json"
$stopScript = Join-Path $PSScriptRoot "stop-portable.ps1"

if (-not (Test-Path $seedFile)) {
  throw "Seed data template not found: $seedFile"
}

& $stopScript

Copy-Item -Path $seedFile -Destination $jsonFile -Force
Remove-Item $dbFile, $dbWal, $dbShm -Force -ErrorAction SilentlyContinue

Write-Host "Demo data reset. The next start will recreate the initial SQLite database."
