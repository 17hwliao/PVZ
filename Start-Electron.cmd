@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the source development edition.
  pause
  exit /b 1
)
node "%~dp0tools\start-electron.cjs"
if errorlevel 1 pause
