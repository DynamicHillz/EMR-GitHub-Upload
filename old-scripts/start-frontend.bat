@echo off
echo ===============================================
echo Starting SSMC EMR Frontend Server
echo ===============================================
echo.
cd /d "%~dp0"
call npm run dev:frontend
pause
