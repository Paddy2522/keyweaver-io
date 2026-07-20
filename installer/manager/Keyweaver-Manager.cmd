@echo off
setlocal
cd /d "%~dp0"
:: Launch via VBS so no PowerShell console flashes.
wscript.exe //nologo "%~dp0Keyweaver-Manager.vbs"
exit /b 0
