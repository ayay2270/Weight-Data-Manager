@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Virtual environment is missing.
  echo Run setup_server.bat once, then start_server.bat again.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" start_server.py
if errorlevel 1 pause

