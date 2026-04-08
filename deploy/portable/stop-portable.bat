@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0stop-portable.ps1"
endlocal
