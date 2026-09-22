@echo off
setlocal EnableExtensions
cd /d "%~dp0"

rem Maintainer-only test runner. Department users never need this.
if not exist ".venv\Scripts\python.exe" (
  echo.
  echo TESTS FAILED
  echo.
  echo .venv is missing. On a BUILD MACHINE, run build_release.bat first
  echo ^(it creates the venv and installs requirements^), then re-run this script.
  echo Department Host PC users do not run tests or Python.
  echo.
  exit /b 1
)

".venv\Scripts\python.exe" -m pytest -q
if errorlevel 1 (
  echo.
  echo TESTS FAILED
  echo.
  exit /b 1
)
exit /b 0
