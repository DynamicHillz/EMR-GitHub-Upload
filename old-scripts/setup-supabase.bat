@echo off
echo.
echo ============================================
echo  SSMC EMR - Supabase Quick Setup
echo ============================================
echo.

REM Check if .env exists
if exist ".env" (
    echo [INFO] .env file already exists
    echo.
    set /p OVERWRITE="Do you want to overwrite it? (y/N): "
    if /i not "%OVERWRITE%"=="y" (
        echo Keeping existing .env file
        goto :skip_env
    )
)

REM Copy .env.example to .env
echo [1/4] Creating .env file from template...
copy .env.example .env >nul
echo        ✓ .env file created
echo.

:skip_env

REM Prompt for Supabase details
echo [2/4] Configure Supabase Connection
echo.
echo Please enter your Supabase connection details:
echo (You can find these at: https://app.supabase.com → Settings → Database)
echo.

set /p SUPABASE_URL="Enter your Supabase connection string: "
set /p JWT_SECRET="Enter a JWT secret (or press Enter to auto-generate): "

REM Generate JWT secret if not provided
if "%JWT_SECRET%"=="" (
    echo        Generating random JWT secret...
    for /f %%i in ('node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"') do set JWT_SECRET=%%i
)

REM Update .env file
echo.
echo [3/4] Updating .env file...
powershell -Command "(gc .env) -replace 'DATABASE_URL=.*', 'DATABASE_URL=\"%SUPABASE_URL%\"' | Out-File -encoding ASCII .env"
powershell -Command "(gc .env) -replace 'JWT_SECRET=.*', 'JWT_SECRET=\"%JWT_SECRET%\"' | Out-File -encoding ASCII .env"
echo        ✓ .env file updated
echo.

REM Generate Prisma Client and run migrations
echo [4/4] Setting up database...
echo.
echo        Running: npm run prisma:generate
call npm run prisma:generate
echo.
echo        Running: npm run prisma:migrate
call npm run prisma:migrate
echo.

echo ============================================
echo  ✓ Setup Complete!
echo ============================================
echo.
echo Next steps:
echo   1. Start backend:  npm run dev:backend
echo   2. Start frontend: npm run dev:frontend
echo   3. Open browser:   http://localhost:5173
echo.
echo For more info, see: SETUP_SUPABASE.md
echo.
pause
