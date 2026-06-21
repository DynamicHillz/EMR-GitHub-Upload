@echo off
echo ============================================================
echo St. Stephen EMR - Database Setup
echo ============================================================
echo.
echo This script will create:
echo   - Default tenant: St. Stephen Hospital
echo   - Admin user: admin@hospital.com / Admin@123
echo.
echo ============================================================
echo.

REM Load environment variables from .env file
for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
    if "%%a"=="DATABASE_URL" set DATABASE_URL=%%b
)

if "%DATABASE_URL%"=="" (
    echo ERROR: DATABASE_URL not found in .env file
    pause
    exit /b 1
)

echo Running setup SQL script...
echo.

psql "%DATABASE_URL%" -f setup-supabase.sql

echo.
echo ============================================================
echo.
pause
