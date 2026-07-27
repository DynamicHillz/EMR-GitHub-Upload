# Clinic PC Deployment Checklist

Follow this top-to-bottom, in order, when setting up a **new physical machine** as the real SSMC EMR server (as opposed to a developer's PC). Everything here was proven to work on a dev machine on 2026-07-27, but several steps (TLS certs, PM2 boot recovery, the backup schedule) are bound to that specific machine's hostname/IP and Windows account — they must be redone here, not copied over.

Where a step just says "see CLAUDE.md," the detailed explanation of *why* lives there — this document is the ordered checklist, CLAUDE.md is the reference.

## 1. Prerequisites

- [ ] Node.js (LTS) installed.
- [ ] PostgreSQL installed, running, and its `bin/` directory (e.g. `C:\Program Files\PostgreSQL\16\bin`) added to `PATH` — required for `pg_dump`/`pg_restore` (backups) and `psql`/`createdb` to resolve without a hardcoded path.
- [ ] `npm install -g pm2` (process manager — see CLAUDE.md "Production Process Management").
- [ ] Chocolatey installed, then `choco install mkcert` (local HTTPS certificate authority — see CLAUDE.md "TLS / HTTPS").
- [ ] Decide the Windows account this will run under. Enable `AutoAdminLogon` for it now (`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon`) if it isn't already — step 6 depends on this account logging in automatically after every reboot/power cycle.

## 2. Get the code running

- [ ] Clone the repo onto this machine.
- [ ] `npm install`.
- [ ] Create `.env` (there's no `.env.example` to copy — see CLAUDE.md's Environment Configuration note). At minimum set:
  - `DATABASE_URL` / `DIRECT_URL` — pointing at this machine's local PostgreSQL instance (both the same connection unless/until this ever moves to a managed pooler — see CLAUDE.md's Database Connection Requirements note). Give `DATABASE_URL` a `connection_limit` (e.g. `?connection_limit=10&pool_timeout=20`).
  - `JWT_SECRET` — a real random secret. `server.ts` refuses to start without one.
  - `NODE_ENV=production`, `PORT=3000`.
  - `TLS_CERT_PATH=certs/server.crt`, `TLS_KEY_PATH=certs/server.key` (files generated in step 4).
  - `CORS_ORIGIN` — leave unset for now; come back and set it once you know this machine's real LAN IP/hostname (step 4 gives you both).
  - Any payment gateway / SMS / email provider keys this clinic actually uses (see the full key list already in `.env` on the dev machine if you need a reference for names — do not copy values, only names).

## 3. Database schema

- [ ] `npx prisma migrate deploy` — applies the full tracked migration history in one shot. **Do not use `migrate dev` or `db push` here** — this is a fresh database being brought up to the current schema, not active schema development.
- [ ] `node scripts/final-create-admin.js` — creates the initial tenant and an admin login (`admin@hospital.com` / `Admin@123`). **Log in once and change that password immediately.**

## 4. TLS (HTTPS)

- [ ] `mkcert -install` — creates and trusts a local root CA on this machine.
- [ ] Find this machine's actual LAN IP (`ipconfig`) and hostname (`$env:COMPUTERNAME` in PowerShell).
- [ ] `mkcert -cert-file certs/server.crt -key-file certs/server.key localhost 127.0.0.1 <that LAN IP> <that hostname>` — generates the real cert. `certs/` is gitignored; this never gets committed.
- [ ] Go back to `.env` and set `CORS_ORIGIN=https://<LAN IP>:5173,https://<hostname>:5173`.

## 5. Build and start

- [ ] `npm run build:backend && npm run build:frontend`.
- [ ] `pm2 start ecosystem.config.js`.
- [ ] `pm2 save` — persists the running app list so step 6 knows what to bring back after a reboot.
- [ ] From this machine, confirm `https://localhost:3000/health` responds and `https://localhost:5173` loads the login page.

## 6. Boot recovery

- [ ] `npm install -g pm2-windows-startup` then `pm2-startup install` (`pm2 startup` doesn't work natively on Windows — see CLAUDE.md "Boot-time recovery").
- [ ] Confirm the registry entry exists: `reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v PM2`.
- [ ] Re-run `pm2 save` if the app list has changed since step 5.

## 7. Backups

- [ ] Register the scheduled task (PowerShell, not the Task Scheduler GUI — see CLAUDE.md "Database Backups" for why):
  ```powershell
  $action = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument "scripts\backup-database.js" -WorkingDirectory "<full path to this project root on this machine>"
  $trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
  $principal = New-ScheduledTaskPrincipal -UserId "<this machine's windows username>" -LogonType Interactive -RunLevel Highest
  Register-ScheduledTask -TaskName "SSMC EMR Database Backup" -Action $action -Trigger $trigger -Principal $principal -Description "Daily pg_dump backup of the SSMC EMR PostgreSQL database"
  ```
- [ ] `Start-ScheduledTask -TaskName "SSMC EMR Database Backup"`, then confirm a fresh file lands in `backups/`.
- [ ] Do one real restore drill into a scratch database before trusting the backup (see CLAUDE.md's Restore procedure) — an untested backup is not a verified backup.

## 8. Distribute trust to workstations

- [ ] On this machine, locate the root CA: `mkcert -CAROOT` (look for `rootCA.pem`).
- [ ] Copy that file to every workstation that will use the app (nurse stations, doctor's office, reception, pharmacy, cashier) and trust it in each machine's certificate store (or push via group policy if the clinic has one). Skipping this means every other workstation sees a cert warning instead of a clean padlock.
- [ ] From a second workstation, load `https://<hostname or LAN IP>:5173` and confirm no cert warning, then log in and confirm it works end-to-end.

## 9. Final verification — reboot test

This is the one step that was impossible to do meaningfully on a dev machine, because it isn't the real target.

- [ ] Reboot this machine.
- [ ] Without logging in manually (or logging in exactly once, if `AutoAdminLogon` requires a physical presence to trigger — it shouldn't), wait ~1 minute, then check `pm2 status` from a remote session or physically at the machine.
- [ ] Confirm both `ssmc-emr-backend` and `ssmc-emr-frontend` are `online`.
- [ ] Confirm the app is reachable from a workstation without anyone having touched the server machine after the reboot.

If this step fails, check: `AutoAdminLogon` registry values, the `pm2-windows-startup` registry entry from step 6, and that `pm2 save` in step 5/6 actually captured both apps (`pm2 status` before rebooting should show both).
