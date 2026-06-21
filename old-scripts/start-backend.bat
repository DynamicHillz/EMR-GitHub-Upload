@echo off
echo ===============================================
echo Starting SSMC EMR Backend Server
echo ===============================================
echo.
cd /d "%~dp0"
call npm run dev:backend
pause
