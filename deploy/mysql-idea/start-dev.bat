@echo off
setlocal
start "ParkSphere API" cmd /k "cd /d %~dp0 && npm run dev:api"
start "ParkSphere Frontend" cmd /k "cd /d %~dp0 && npm run dev"
endlocal
