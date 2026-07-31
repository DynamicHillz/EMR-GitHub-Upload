# Incident Runbook — SSMC EMR

**Read this before you sell an install, not after the first Saturday-night call.**

This covers the five most likely ways this system fails in production, written so you can follow it under pressure without needing to read or understand the underlying code. Each scenario has: how you'll know it's happening, how to check what's actually wrong, the fix, and when to stop and escalate instead of guessing.

**Before you rely on this**: walk through every scenario below once, on a real machine, before a real clinic is depending on it. A runbook you haven't tested is a guess with extra formatting.

---

## 0. First response, every time

Before diagnosing anything specific:

1. Note the time and what the person reporting it actually saw (exact error message, which page, which action). You will forget the details in five minutes; write them down now.
2. Check `pm2 status` first, always — most failures show up here immediately.
3. Don't restart anything yet if you can avoid it — a running-but-broken system preserves evidence; a restarted one often doesn't.

```powershell
pm2 status
```

Both `ssmc-emr-backend` and `ssmc-emr-frontend` should say `online`. If either doesn't, go to Scenario 1. If both say `online` but the clinic still can't use it, go to Scenario 2.

---

## Scenario 1 — App is unreachable ("can't connect," blank page, spinner forever)

**Symptom**: Staff can't load the page at all, or it loads and then everything times out.

**Diagnosis**:
```powershell
pm2 status
pm2 logs ssmc-emr-backend --lines 50 --nostream
pm2 logs ssmc-emr-frontend --lines 50 --nostream
```
Look for the app showing `errored` or `stopped`, or a restart count (`↺`) that's climbing — that means it's crash-looping.

**Tested live during development**: killing the backend process outright (simulating a hard crash) was auto-recovered by PM2 itself in under 5 seconds, with zero manual action — this is `autorestart: true` in `ecosystem.config.js` already doing its job. So if `pm2 status` shows a climbing restart count but the app comes back and stays up, that's the system working as designed, not a problem to manually intervene on.

**Manual restart is for when the process is alive but hung** — `pm2 status` shows `online`, restart count isn't climbing, but the app still doesn't respond. PM2 can't detect "running but broken," only "running or not," so this is the one case that needs a human:
```powershell
pm2 restart ssmc-emr-backend ssmc-emr-frontend
pm2 status
```
Wait 10 seconds, check `pm2 status` again — both should be `online` with a stable restart count and the app should actually respond, not just show `online`.

**Still down after restart, or it keeps crash-looping instead of settling?** Check the error log for the actual reason (`pm2 logs ssmc-emr-backend --err --lines 50 --nostream`). The two most common real causes:
- PostgreSQL isn't running → see Scenario 4.
- Disk is full (backups piling up, logs) → check with `Get-PSDrive C` in PowerShell; free space if critically low.

**Escalate if**: restart doesn't hold (it crashes again within a minute or two) and the error log doesn't point at something in Scenario 4. That's a real bug, not an ops issue — don't keep restarting hoping it clears itself.

---

## Scenario 2 — Staff can log in to the page loading, but actions fail / "Network Error"

**Symptom**: The login page (or any page) loads fine, but submitting anything fails, often with a generic "Network Error."

**This exact failure already happened once during development** — a stale cached version of the app in someone's browser calling the wrong URL. It's usually not the server at all.

**Diagnosis, in order**:
1. Confirm the server itself is actually fine: `pm2 status` (both online), then from the server machine itself, open `https://localhost:3000/health` in a browser — should show `{"status":"healthy",...}`.
2. If the server is healthy but one specific workstation is broken: that workstation has a stale cached copy of the app.

**Fix for a stale workstation**:
1. Close every browser tab/window pointed at the app on that machine.
2. Reopen and try again — this alone often fixes it.
3. If not: open DevTools (F12) → Application tab → Service Workers → **Unregister** → reload.
4. If a new workstation was never given the certificate: see Scenario 5.

**Escalate if**: it's happening on every workstation simultaneously, not just one — that's a real server-side problem (check Scenario 4, database).

---

## Scenario 3 — Machine was rebooted (power outage, Windows update) and the app didn't come back

**Symptom**: Nobody touched the server, but at some point after a reboot, nothing works.

**Diagnosis**:
```powershell
pm2 status
```
If PM2 itself shows nothing running or errors out entirely, the boot-recovery chain didn't fire.

**Fix**:
```powershell
pm2 resurrect
pm2 status
```
This alone fixes it in almost every case — it reloads the saved process list. If `pm2 resurrect` says there's nothing to resurrect:
```powershell
cd <project folder>
pm2 start ecosystem.config.js
pm2 save
```

**Why this happens**: the boot-recovery mechanism depends on the Windows account auto-logging in after a reboot. If someone changes the Windows password or disables auto-login, recovery silently stops working until the next manual fix — worth checking `AutoAdminLogon` in the registry if this becomes a repeat problem.

**Escalate if**: `pm2 resurrect` and a manual `pm2 start` both fail outright (rare — usually means Node.js itself or PostgreSQL isn't starting, which is a deeper machine problem).

---

## Scenario 4 — Everything gives errors, especially anything touching patient/billing data

**Symptom**: Pages load, but almost every action fails, often with "Internal Server Error."

**Diagnosis** — check the full log, not just the error stream (Prisma's errors land in the regular output log, not necessarily the error one):
```powershell
pm2 logs ssmc-emr-backend --lines 30 --nostream
```
**Tested live during development**: the exact real error text when PostgreSQL is down is `Can't reach database server at 'localhost:5434'` / `PrismaClientKnownRequestError ... code: P1001`. That's the specific string to look for — much more reliable than guessing at generic connection-error wording.

**Fix**:
1. Confirm PostgreSQL is actually running: `Get-Service postgresql*` (note: this machine has multiple PostgreSQL versions installed side by side — confirm which service is actually bound to the app's port with `netstat -ano | findstr :5434`, don't assume it's the one with the "obvious" version number). If it's stopped, `Start-Service <name>`.
2. **Confirmed by test**: once PostgreSQL is running again, the app reconnects on its own — no `pm2 restart` needed. Give it a few seconds, then just try logging in again before restarting anything.
3. If it's running but overloaded ("too many connections"): `pm2 restart ssmc-emr-backend` to release its connection pool, then check nothing else on the machine is hammering the database.
4. If PostgreSQL itself won't start: **don't troubleshoot database internals alone under pressure** — this is exactly the point to escalate rather than guess.

**Escalate if**: PostgreSQL won't start, or logs show data corruption / disk errors. This is the scenario closest to needing the actual backup restore procedure below — don't attempt a restore over the live database without being sure it's actually necessary.

---

## Scenario 5 — Data loss, or a browser shows a certificate warning it never showed before

Two different problems, same section because both have a tested, documented fix already.

**5a. Certificate warning on a workstation** (usually: a new PC was added and never given the root CA). Fix: copy `rootCA.pem` from the server (`mkcert -CAROOT` shows the folder) to the new machine and trust it in its certificate store — see `CLINIC_DEPLOYMENT_CHECKLIST.md` step 8.

**5b. Real data loss / corruption** — restore from backup:
```bash
# Sanity-check the backup without touching anything live:
pg_restore --list backups/ssmc_emr_<latest-timestamp>.dump

# Restore into a scratch database FIRST, always — never restore
# directly over the live database as a first move:
createdb -h localhost -p 5434 -U postgres ssmc_emr_restore_test
pg_restore -h localhost -p 5434 -U postgres -d ssmc_emr_restore_test backups/ssmc_emr_<latest-timestamp>.dump

# Only once you've confirmed the scratch restore looks right,
# restoring over the real database (this causes downtime — coordinate
# with the clinic before running it, don't do this silently):
pg_restore -h localhost -p 5434 -U postgres -d ssmc_emr -c backups/ssmc_emr_<latest-timestamp>.dump
```

**This exact procedure was tested end-to-end during development** — a real backup was restored into a scratch database and verified to contain real patient rows. It works. The risk isn't whether the procedure works; it's using it correctly under pressure — which is why the scratch-database step is mandatory, not optional, even when it feels slower than the situation allows.

**Escalate if**: you're not confident which backup file is the right one, or the scratch restore doesn't look right. Guessing here is the one mistake that can make things permanently worse.

---

## Updating the live system — rollback path

Before pushing any update to a live clinic:

1. Note the current commit: `git log --oneline -1` (write this down somewhere outside the machine).
2. Take a fresh backup first, even if one ran overnight: `node scripts/backup-database.js`.
3. Deploy the update, rebuild, restart.
4. **If anything looks wrong after deploying**:
   ```bash
   git checkout <the commit you noted in step 1>
   npm run build:backend && npm run build:frontend
   pm2 restart ssmc-emr-backend ssmc-emr-frontend
   ```
   This rolls back the code. It does **not** roll back a database migration if the update included one — if a schema change was part of the update, rolling back code alone can leave the database and the code out of sync. Test schema changes on a scratch database copy before ever running them against the live one (see `CLAUDE.md`'s Prisma Migration History section).

---

## What this runbook doesn't cover

If you hit something not listed here, that's real information — add it to this file once you've solved it, so next time it's a five-minute lookup instead of a from-scratch investigation. A runbook that never grows isn't being used honestly.
