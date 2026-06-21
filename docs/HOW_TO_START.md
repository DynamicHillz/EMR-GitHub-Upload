# How to Start SSMC EMR

## Quick Start (Recommended)

**Double-click [start-clean.bat](start-clean.bat)** in the project root folder.

This script will:
1. Kill any existing Node.js processes
2. Start the backend server in a new window
3. Start the frontend server in a new window

## What You'll See

Two command windows will open:
- **SSMC Backend** - Backend server logs (port 3000)
- **SSMC Frontend** - Frontend server logs (port 5173)

## Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Health Check**: http://localhost:3000/health

## Login Credentials

```
Email: admin@hospital.com
Password: Admin@123
Tenant: St. Stephen Hospital
```

## Manual Start (Alternative)

If the batch script doesn't work, start manually:

### Terminal 1 - Backend
```bash
cd "c:\Users\WINDOWS11\Documents\PythonProject\St.stephen EMR"
npm run dev:backend
```

### Terminal 2 - Frontend
```bash
cd "c:\Users\WINDOWS11\Documents\PythonProject\St.stephen EMR"
npm run dev:frontend
```

## Troubleshooting

### "Prepared Statement Already Exists" Error

This error occurs when multiple Node.js processes are running.

**Solution**:
1. Close all terminal windows running the servers
2. Kill all node processes: `taskkill /F /IM node.exe`
3. Run [start-clean.bat](start-clean.bat) again

### Login Fails

**Check**:
1. Backend server is running (should see "Server running on port 3000")
2. Database is accessible (should see "Database connected successfully")
3. Using correct credentials (see above)

### User Creation Fails

**Common causes**:
1. Multiple node processes (see "Prepared Statement" error above)
2. Database connection issues
3. Email already exists for the tenant

**Solution**:
- Restart using [start-clean.bat](start-clean.bat)
- Check backend logs for specific error messages

## Important Notes

⚠️ **Do NOT start multiple instances** of the backend or frontend
⚠️ **Always use [start-clean.bat](start-clean.bat)** to ensure clean startup
⚠️ **Keep both terminal windows open** while using the application

## Configuration

Database configuration is in [.env](.env):
- Uses Supabase PostgreSQL (connection pooling with pgbouncer)
- JWT authentication with 8-hour token expiry
- Development mode logging enabled

## Next Steps

After logging in, you can:
1. Create new users (User Management)
2. Register patients
3. Schedule appointments
4. Record consultations
5. Manage billing

For more information, see [README.md](README.md)
