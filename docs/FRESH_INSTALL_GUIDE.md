# Fresh Installation Guide - SSMC EMR

Complete guide for installing SSMC EMR Desktop Application on a new system.

---

## Prerequisites

### Required Software

1. **Node.js** (v18.x or v20.x recommended)
   - Download: https://nodejs.org/
   - Verify installation: `node --version` (should be v18.0.0 or higher)
   - npm comes bundled with Node.js

2. **Git** (for cloning the repository)
   - Download: https://git-scm.com/downloads
   - Verify: `git --version`

3. **PostgreSQL** (if using local database) OR **Supabase Account** (recommended)
   - Supabase (Cloud): https://supabase.com (free tier available)
   - PostgreSQL (Local): https://www.postgresql.org/download/

###

 Optional (for development)
- **Visual Studio Code**: https://code.visualstudio.com/
- **Postman**: https://www.postman.com/ (for API testing)

---

## Installation Steps

### Step 1: Get the Code

```bash
# Option A: Clone from repository (if hosted on Git)
git clone https://github.com/your-org/ssmc-emr.git
cd ssmc-emr

# Option B: Extract from ZIP file
# Simply extract the ZIP and navigate to the folder
cd path/to/ssmc-emr
```

### Step 2: Install Dependencies

```bash
# Install ALL dependencies automatically
npm install

# This command installs:
# ✓ Electron (desktop app framework)
# ✓ React + TypeScript (frontend)
# ✓ Express + Prisma (backend)
# ✓ SQLite + SQLCipher (encrypted local database)
# ✓ All development tools and compilers
```

**Time**: ~2-5 minutes depending on internet speed

**Common Issues**:
- If `npm install` fails with Python errors on Windows:
  - Install Visual Studio Build Tools
  - Or use: `npm install --ignore-scripts` (skips native compilation)

- If "EACCES" permission errors:
  - Run PowerShell/Terminal as Administrator
  - Or fix npm permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors

### Step 3: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Or create manually with this content:
```

**.env file content**:
```env
# Database Configuration
DATABASE_URL="postgresql://user:password@host:6543/database?pgbouncer=true"
DIRECT_URL="postgresql://user:password@host:5432/database"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRY="8h"

# Application
NODE_ENV="development"
PORT=3000

# Tenant Configuration
DEFAULT_TENANT_ID="clinic-001"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Sync Configuration
SYNC_INTERVAL_MS=900000  # 15 minutes
```

**For Supabase** (recommended):
1. Create project at https://supabase.com
2. Go to Settings → Database → Connection String
3. Copy "Connection pooling" string → `DATABASE_URL`
4. Copy "Direct connection" string → `DIRECT_URL`
5. **Important**: URL-encode special characters in password (`#` becomes `%23`)

### Step 4: Generate Prisma Client

```bash
npm run prisma:generate
```

This creates the database client based on your schema.

### Step 5: Initialize Database

```bash
# Push schema to database (creates all tables)
npx prisma db push --accept-data-loss

# Or use migrations (production)
npm run prisma:migrate
```

This creates 110+ tables including:
- Patients, Appointments, Consultations
- Prescriptions, Lab Tests, Pharmacy
- Billing, Invoices, Payments
- Users, Roles, Permissions
- Sync Queue, Audit Logs

### Step 6: Create Initial Admin User

```bash
node final-create-admin.js
```

This will:
1. Create the tenant (clinic)
2. Create an admin user
3. Display login credentials

**Save these credentials!** You'll need them to login.

Example output:
```
✓ Tenant created: clinic-001
✓ Admin user created

  Login Credentials:
  Email: admin@clinic.com
  Password: Admin@123456
  Role: SUPER_ADMIN
```

### Step 7: Verify Installation

```bash
# Check database tables
npm run prisma:studio

# This opens a browser-based database GUI
# Verify tables exist and admin user is present
```

---

## Running the Application

### Development Mode (3 terminals)

**Terminal 1 - Backend Server**:
```bash
npm run dev:backend

# Should see:
# ✓ Database connected
# ✓ Server running on port 3000
```

**Terminal 2 - Frontend Dev Server**:
```bash
npm run dev:frontend

# Should see:
# ✓ VITE ready
# ✓ Local: http://localhost:5173
```

**Terminal 3 - Electron Desktop App**:
```bash
npm run dev:electron

# This will:
# 1. Compile Electron TypeScript
# 2. Launch desktop application window
# 3. Initialize encrypted local database
# 4. Start network monitoring
```

The desktop app will open automatically and load from `http://localhost:5173`.

### Production Build

```bash
# Build all components
npm run build:all

# Create desktop installers
npm run build:electron

# Output:
# dist-electron/
# ├── SSMC EMR-1.0.0.exe          (Windows installer)
# ├── SSMC EMR-1.0.0.dmg          (macOS disk image)
# └── SSMC EMR-1.0.0.AppImage     (Linux portable)
```

---

## First Login

1. Desktop app opens automatically (or go to http://localhost:5173 in browser)
2. Enter credentials from Step 6
3. You'll see the Dashboard

**Initial Setup in App**:
1. Go to **Settings** → **Clinic** tab
2. Upload clinic logo
3. Set clinic name and address
4. Configure branding (colors, fonts)

---

## Verification Checklist

After installation, verify these work:

- [ ] Backend server starts without errors
- [ ] Frontend dev server runs on port 5173
- [ ] Electron app window opens
- [ ] Login with admin credentials succeeds
- [ ] Dashboard displays
- [ ] Network status indicator shows "Online" (green badge)
- [ ] Sync status shows "Synced"
- [ ] Can navigate to all menu items
- [ ] Local database created at: `{AppData}/SSMC EMR/data/ssmc_emr_local.db`
- [ ] Encryption key exists at: `{AppData}/SSMC EMR/.dbkey`

**AppData Locations**:
- **Windows**: `C:\Users\YourName\AppData\Roaming\SSMC EMR\`
- **macOS**: `~/Library/Application Support/SSMC EMR/`
- **Linux**: `~/.config/SSMC EMR/`

---

## Troubleshooting

### Issue: "Cannot connect to database"

**Solution**:
1. Verify `.env` file exists and has correct DATABASE_URL
2. Check Supabase project is running (not paused)
3. Test connection: `npm run db:check`
4. Ensure password is URL-encoded in connection string

### Issue: "Prisma Client not generated"

**Solution**:
```bash
npm run prisma:generate
# Then restart backend server
```

### Issue: "Login fails / No admin user"

**Solution**:
```bash
# Check if user exists
node list-tenants.js

# If not, recreate
node final-create-admin.js
```

### Issue: "Electron app won't start"

**Solution**:
```bash
# Rebuild Electron main process
npm run build:electron:main

# Check for errors
npx electron .

# If SQLite errors, rebuild native modules
npm rebuild better-sqlite3 --build-from-source
```

### Issue: "Port 3000 or 5173 already in use"

**Solution**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :3000
kill -9 <PID>
```

### Issue: "TypeScript compilation errors"

**Solution**:
```bash
# Clean build directories
rm -rf dist node_modules package-lock.json

# Reinstall
npm install

# Rebuild
npm run build:all
```

---

## System Requirements

### Minimum Requirements
- **OS**: Windows 10 (64-bit), macOS 10.13+, or Ubuntu 18.04+
- **RAM**: 4GB
- **Storage**: 2GB free space
- **Internet**: Required for initial setup and cloud sync

### Recommended Requirements
- **OS**: Windows 11, macOS 12+, or Ubuntu 22.04+
- **RAM**: 8GB or more
- **Storage**: 10GB free space (for local database and backups)
- **Internet**: Broadband (for reliable sync)

---

## Security Notes

1. **Encryption Key**: Automatically generated on first run
   - Stored in: `{AppData}/.dbkey`
   - **NEVER** share this file
   - **BACKUP** this file securely (without it, local data is inaccessible)

2. **Database**: Local SQLite encrypted with AES-256
   - All patient data encrypted at rest
   - Automatic encryption/decryption

3. **JWT Secret**: Change `JWT_SECRET` in `.env` before production deployment
   - Use a strong random value (32+ characters)
   - Never commit `.env` to version control

4. **Passwords**: Default admin password should be changed immediately after first login

---

## Updating the Application

```bash
# Pull latest code (if using Git)
git pull origin main

# Install any new dependencies
npm install

# Update database schema
npx prisma db push

# Rebuild application
npm run build:all

# Restart servers
```

---

## Uninstallation

### Remove Application Files
```bash
# Simply delete the project folder
rm -rf path/to/ssmc-emr
```

### Remove Application Data (Optional)
- **Windows**: Delete `C:\Users\YourName\AppData\Roaming\SSMC EMR\`
- **macOS**: Delete `~/Library/Application Support/SSMC EMR/`
- **Linux**: Delete `~/.config/SSMC EMR/`

**Warning**: This deletes the local database and encryption key. Ensure data is synced to cloud first!

### Remove Cloud Database (Supabase)
- Go to Supabase dashboard
- Delete the project
- All cloud data will be permanently deleted

---

## Support

For issues or questions:

1. Check this guide's **Troubleshooting** section
2. Review `TROUBLESHOOTING.md` in the project root
3. Check logs:
   - Backend: Terminal output
   - Frontend: Browser console (F12)
   - Electron: DevTools console
4. Contact support: support@ssmc-emr.com

---

## Quick Reference Commands

```bash
# Development
npm run dev:backend           # Start backend
npm run dev:frontend          # Start frontend
npm run dev:electron          # Start desktop app

# Building
npm run build:backend         # Compile backend
npm run build:frontend        # Build frontend
npm run build:electron:main   # Compile Electron
npm run build:electron        # Create installers
npm run build:all             # Build everything

# Database
npm run prisma:generate       # Generate Prisma client
npm run prisma:migrate        # Run migrations
npm run prisma:studio         # Open database GUI
node final-create-admin.js    # Create admin user
node list-tenants.js          # List all tenants/users

# Utilities
npm run lint                  # Check code quality
npm run format                # Format code
npm test                      # Run tests
```

---

**Installation Complete!** 🎉

You're now ready to use SSMC EMR Desktop Application.

**Next Steps**:
1. Complete clinic setup in Settings
2. Create additional user accounts
3. Configure branding and colors
4. Start registering patients

---

**Document Version**: 1.0
**Last Updated**: January 27, 2026
**For SSMC EMR v1.0.0**
