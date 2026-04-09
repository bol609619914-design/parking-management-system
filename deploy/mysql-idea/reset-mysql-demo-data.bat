@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0reset-mysql-demo-data.ps1"
endlocal
