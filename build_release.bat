@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo Weight Data Manager — Windows release build
echo This script is for a BUILD MACHINE only. Department users never run it.
echo.

rem --- Locate Python (build machine requirement) ---
set "PYEXE="

rem GitHub Actions / CI: prefer the setup-python "python" on PATH
if defined GITHUB_ACTIONS goto use_ci_python
if /I "%CI%"=="true" goto use_ci_python
goto find_python

:use_ci_python
where python >nul 2>&1
if errorlevel 1 (
  echo.
  echo BUILD FAILED: GITHUB_ACTIONS/CI is set but python was not found on PATH.
  echo.
  exit /b 1
)
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
if errorlevel 1 (
  echo.
  echo BUILD FAILED: CI Python must be 3.11 or newer.
  echo.
  exit /b 1
)
set "PYEXE=python"
goto python_ready

:find_python
where py >nul 2>&1
if not errorlevel 1 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
  if not errorlevel 1 set "PYEXE=py -3"
)
if not defined PYEXE (
  where python >nul 2>&1
  if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" >nul 2>&1
    if not errorlevel 1 set "PYEXE=python"
  )
)

if not defined PYEXE (
  echo.
  echo ============================================================
  echo BUILD FAILED
  echo ============================================================
  echo Python 3.11+ was not found on this machine.
  echo.
  echo This is a BUILD MACHINE requirement. Install Python 3.11 or
  echo newer from https://www.python.org/downloads/ and ensure
  echo "Add python.exe to PATH" is enabled, then run this script again.
  echo.
  echo Department Host PC users do NOT need Python. They only run
  echo Weight Data Manager.exe from the finished release folder.
  echo ============================================================
  echo.
  exit /b 1
)

:python_ready

echo Using Python: %PYEXE%
%PYEXE% -c "import sys; print(sys.version)"
if errorlevel 1 (
  echo.
  echo BUILD FAILED: Python could not start.
  echo.
  exit /b 1
)

rem --- Virtual environment ---
if not exist ".venv\Scripts\python.exe" (
  echo Creating .venv ...
  %PYEXE% -m venv .venv
  if errorlevel 1 (
    echo.
    echo BUILD FAILED: could not create .venv
    echo.
    exit /b 1
  )
)

set "VENV_PY=.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
  echo.
  echo BUILD FAILED: .venv\Scripts\python.exe is missing after venv create.
  echo.
  exit /b 1
)

echo Upgrading pip ...
"%VENV_PY%" -m pip install --upgrade pip
if errorlevel 1 (
  echo.
  echo BUILD FAILED: pip upgrade failed.
  echo.
  exit /b 1
)

echo Installing requirements ...
"%VENV_PY%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo BUILD FAILED: could not install requirements.txt
  echo.
  exit /b 1
)

echo Installing PyInstaller ...
"%VENV_PY%" -m pip install pyinstaller==6.11.1
if errorlevel 1 (
  echo.
  echo BUILD FAILED: could not install PyInstaller.
  echo.
  exit /b 1
)

"%VENV_PY%" -c "import PyInstaller; print('PyInstaller', PyInstaller.__version__)"
if errorlevel 1 (
  echo.
  echo BUILD FAILED: PyInstaller is not importable.
  echo.
  exit /b 1
)

echo.
echo Building Weight Data Manager.exe ...
"%VENV_PY%" -m PyInstaller --noconfirm --clean "Weight Data Manager.spec"
if errorlevel 1 (
  echo.
  echo BUILD FAILED: PyInstaller reported an error.
  echo.
  exit /b 1
)

set "RELEASE=dist\Weight Data Manager"
if not exist "%RELEASE%\Weight Data Manager.exe" (
  echo.
  echo BUILD FAILED: expected file missing:
  echo   %RELEASE%\Weight Data Manager.exe
  echo.
  exit /b 1
)

copy /Y "README.md" "%RELEASE%\README.md" >nul
if errorlevel 1 (
  echo.
  echo BUILD FAILED: could not copy README.md into the release folder.
  echo.
  exit /b 1
)

echo.
echo ============================================================
echo BUILD SUCCEEDED
echo ============================================================
echo Release folder:
echo   %CD%\%RELEASE%
echo.
echo Outer layer:
echo   Weight Data Manager.exe
echo   README.md
echo   _internal\
echo.
echo Deploy that folder to the Host PC. End users only double-click
echo Weight Data Manager.exe — no Python, BAT, PowerShell, or CMD.
echo ============================================================
echo.
exit /b 0
