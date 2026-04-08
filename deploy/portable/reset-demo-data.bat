@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0reset-demo-data.ps1"
endlocal
