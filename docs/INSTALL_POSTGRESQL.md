# PostgreSQL Installation Guide for Windows

Since automatic installation requires administrator privileges, please follow these steps to install PostgreSQL manually.

---

## Option 1: Download and Install (Recommended)

### Step 1: Download PostgreSQL

1. Open your browser and go to: https://www.postgresql.org/download/windows/
2. Click on "Download the installer"
3. Click on "PostgreSQL 16" (or latest version)
4. Download the Windows x86-64 installer

### Step 2: Run the Installer

1. **Double-click** the downloaded `.exe` file
2. **Click "Yes"** when Windows asks for administrator permission
3. **Installation Wizard:**
   - Click "Next" on Welcome screen
   - **Installation Directory:** Keep default (`C:\Program Files\PostgreSQL\16`)
   - **Select Components:** Check all boxes (PostgreSQL Server, pgAdmin 4, Command Line Tools)
   - **Data Directory:** Keep default
   - **Password:** Enter a password (IMPORTANT: Remember this!)
     - Suggestion: Use something simple for development like `postgres` or `admin123`
     - Write it down!
   - **Port:** Keep default `5432`
   - **Locale:** Keep default
   - Click "Next" through remaining screens
   - Click "Finish"

### Step 3: Verify Installation

Open a **new** Command Prompt (important: new window to refresh PATH) and run:

```bash
psql --version
```

You should see something like: `psql (PostgreSQL) 16.x`

If you get "command not found", add to PATH manually:
1. Search for "Environment Variables" in Windows
2. Edit "Path" under System variables
3. Add: `C:\Program Files\PostgreSQL\16\bin`
4. Click OK and restart Command Prompt

---

## Option 2: Use PowerShell with Admin Rights

If you prefer command-line installation:

1. **Open PowerShell as Administrator:**
   - Search for "PowerShell" in Start menu
   - Right-click "Windows PowerShell"
   - Click "Run as Administrator"

2. **Run this command:**
   ```powershell
   choco install postgresql16 -y
   ```

3. **Wait for installation** (5-10 minutes)

4. **Set password:**
   ```powershell
   psql -U postgres
   \password postgres
   # Enter your password twice
   \q
   ```

---

## After Installation: Create Database

Once PostgreSQL is installed, create the database for SSMC EMR:

### Step 1: Connect to PostgreSQL

```bash
psql -U postgres
```

Enter the password you set during installation.

### Step 2: Create Database and User

```sql
-- Create the database
CREATE DATABASE medflow_emr;

-- Create a user
CREATE USER medflow_user WITH PASSWORD 'secure_password_123';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE medflow_emr TO medflow_user;

-- Grant schema privileges (PostgreSQL 15+)
\c medflow_emr
GRANT ALL ON SCHEMA public TO medflow_user;

-- Exit
\q
```

### Step 3: Test Connection

```bash
psql -U medflow_user -d medflow_emr
```

If this works, you're ready to proceed!

---

## Configure SSMC EMR

After PostgreSQL is installed and database created:

### 1. Update .env file

Open `.env` file in the project root and update:

```env
DATABASE_URL="postgresql://medflow_user:secure_password_123@localhost:5432/medflow_emr?schema=public"
```

Replace `secure_password_123` with your actual password.

### 2. Generate Prisma Client

```bash
npm run prisma:generate
```

### 3. Run Migrations

```bash
npm run prisma:migrate
```

### 4. Verify Database

```bash
npm run prisma:studio
```

This opens a web interface to view your database at http://localhost:5555

---

## Common Issues

### "psql: command not found"

**Solution:** Add PostgreSQL to PATH:
1. Windows Search → "Environment Variables"
2. Edit "Path" variable
3. Add `C:\Program Files\PostgreSQL\16\bin`
4. Restart terminal

### "Connection refused"

**Solution:** Check if PostgreSQL service is running:
1. Windows Search → "Services"
2. Find "postgresql-x64-16"
3. Right-click → "Start"

### "Password authentication failed"

**Solution:** Reset password:
```bash
psql -U postgres
\password postgres
# Enter new password
```

---

## Alternative: Use Docker (Advanced)

If you have Docker Desktop installed:

```bash
docker run --name medflow-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=medflow_emr -p 5432:5432 -d postgres:16
```

Then use this DATABASE_URL:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/medflow_emr?schema=public"
```

---

## Next Steps

Once PostgreSQL is installed and configured:

1. Continue to [QUICKSTART.md](QUICKSTART.md) for project setup
2. Run `npm install` to install dependencies
3. Run `npm run prisma:migrate` to set up database schema
4. Start development!

---

**Need Help?**

If you encounter issues:
1. Check PostgreSQL service is running (Services → postgresql-x64-16)
2. Verify port 5432 is not in use: `netstat -ano | findstr :5432`
3. Check firewall isn't blocking PostgreSQL
4. Review logs: `C:\Program Files\PostgreSQL\16\data\log\`
