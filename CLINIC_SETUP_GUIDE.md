# Clinic Setup Guide: St. Stephen EMR

This document outlines the standard operating procedures for deploying the St. Stephen EMR at a new clinic location.

## 1. Prerequisites
Before setting up the EMR, ensure the host server has the following installed:
- **Node.js** (v18+)
- **PostgreSQL** (v15+)
- **Docker & Docker Compose** (Required for clinical diagnostic APIs)

## 2. Infrastructure Setup (Docker)

The EMR relies on external official APIs for clinical features. These must be running on the host server before the EMR starts.

### WHO ICD-11 Clinical Terminology API
The EMR uses the official World Health Organization ICD-11 Docker container for diagnostic coding, searching, and clinical terminology.

Run the following command on the server to start the ICD-11 API in the background:
```bash
docker run -d --restart unless-stopped --env "acceptLicense=true" -p 80:80 whoicd/icd-api
```

**Why these flags?**
- `-d`: Runs the container silently in the background.
- `--env "acceptLicense=true"`: REQUIRED. Automatically accepts the WHO software license agreement; the container will instantly crash without this.
- `--restart unless-stopped`: Ensures the WHO API will automatically boot up whenever the server restarts or recovers from a power outage, exactly like a native Windows/Linux background service.

*Note: The EMR backend is hardcoded to look for this API at `http://localhost:80`. Ensure port 80 is not blocked or occupied by another service.*

### Headless Server Boot Configuration (Docker on Windows)
Because Docker Desktop on Windows requires a user session to start, the API will not boot if the server restarts and stays on the lock screen. To run the server "headlessly":

1. **Configure Auto-Logon:**
   - Download the official Microsoft Sysinternals [Autologon tool](https://learn.microsoft.com/en-us/sysinternals/downloads/autologon).
   - Run the tool and enter the server's Windows password. This encrypts the credentials and tells Windows to automatically log into the desktop upon power loss/restart.
   - Once Windows auto-logs in, Docker Desktop will immediately boot the WHO API.

2. **Configure Auto-Lock:**
   - To maintain physical security of the server after it auto-logs in, open PowerShell as Administrator and run the following command to immediately lock the screen upon login:
   ```powershell
   $Action = New-ScheduledTaskAction -Execute 'rundll32.exe' -Argument 'user32.dll,LockWorkStation'
   $Trigger = New-ScheduledTaskTrigger -AtLogOn
   $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
   Register-ScheduledTask -TaskName 'AutoLockAfterLogon' -Action $Action -Trigger $Trigger -Settings $Settings -Description 'Locks workstation immediately after auto-logon' -Force
   ```

## 3. Database Initialization
Once PostgreSQL is running:
1. Copy `.env.example` to `.env` and configure your database connection string.
2. Run the Prisma migrations to build the schema:
   ```bash
   npx prisma generate
   npx prisma migrate deploy
   ```
3. Run the initial seed script (if applicable) to populate default roles and permissions.

## 4. Starting the EMR
1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the application for production:
   ```bash
   npm run build
   ```
3. Start the server (preferably using a process manager like PM2 so it also auto-restarts on boot):
   ```bash
   pm2 start npm --name "st-stephen-emr" -- run start
   pm2 save
   pm2 startup
   ```

## 5. Verification
- Navigate to the EMR login page on the local network (e.g., `http://<SERVER_IP>:3000`).
- Log in and navigate to a Consultation.
- Search for a diagnosis (e.g., "Cholera"). If results appear instantly, the EMR has successfully connected to the background WHO ICD-11 Docker container.
