@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment is missing. Run setup_server.bat first.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m app.backup
pause

