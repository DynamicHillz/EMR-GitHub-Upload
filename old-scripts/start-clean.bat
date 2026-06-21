@echo off
echo ===============================================
echo SSMC EMR - Clean Start
echo ===============================================
echo.
echo Killing all existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
echo Done.
echo.
echo Waiting 3 seconds for processes to terminate...
timeout /t 3 /nobreak >nul
echo.
echo Starting Backend Server...
start "SSMC Backend" cmd /k "cd /d "%~dp0" && npm run dev:backend"
echo.
echo Waiting 5 seconds before starting frontend...
timeout /t 5 /nobreak >nul
echo.
echo Starting Frontend Server...
start "SSMC Frontend" cmd /k "cd /d "%~dp0" && npm run dev:frontend"
echo.
echo ===============================================
echo Both servers are starting in separate windows
echo ===============================================
echo.
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Login credentials:
echo Email: admin@hospital.com
echo Password: Admin@123
echo.
echo Press any key to close this window...
pause >nul
