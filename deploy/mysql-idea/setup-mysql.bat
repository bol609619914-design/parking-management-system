@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0setup-mysql.ps1"
endlocal
