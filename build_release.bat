@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" call setup_server.bat
if errorlevel 1 exit /b 1

".venv\Scripts\python.exe" -m pip install pyinstaller==6.11.1
if errorlevel 1 exit /b 1

echo Building Weight Data Manager.exe ...
".venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean "Weight Data Manager.spec"
if errorlevel 1 exit /b 1

echo Building First Time Setup.exe ...
".venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean "First Time Setup.spec"
if errorlevel 1 exit /b 1

set "RELEASE=dist\Weight Data Manager"
if not exist "%RELEASE%" (
  echo ERROR: expected release folder missing: %RELEASE%
  exit /b 1
)

copy /Y "dist\First Time Setup\First Time Setup.exe" "%RELEASE%\First Time Setup.exe" >nul
if errorlevel 1 exit /b 1

copy /Y "README.md" "%RELEASE%\README.md" >nul
if errorlevel 1 exit /b 1

echo.
echo Release folder:
echo   %CD%\%RELEASE%
echo.
echo Outer layer should contain:
echo   Weight Data Manager.exe
echo   First Time Setup.exe
echo   README.md
echo   _internal\   ^(PyInstaller runtime — required^)
echo.
echo Data and backups are stored under %%LOCALAPPDATA%%\Weight Data Manager so replacing
echo this folder during an upgrade does not wipe the department database.
echo.
pause
