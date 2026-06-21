# Troubleshooting Supabase Connection

Your connection is failing. Let's fix this step by step.

---

## Issue: Can't reach database server

**Error message:**
```
Can't reach database server at `db.jwhfowlouxmgvkdlgfit.supabase.co:5432`
```

---

## ✅ Checklist to Fix

### 1. Verify Supabase Project is Active

1. Go to: https://app.supabase.com
2. Log in
3. Check your project status
   - ✅ **Green dot** = Active and ready
   - ⏸️ **Paused** = Project needs to be resumed
   - ⚙️ **Setting up** = Wait a few more minutes

**If paused:**
- Click on your project
- Click "Resume project" or "Restore project"
- Wait 2-3 minutes for it to become active

---

### 2. Get the CORRECT Connection String

The connection string might have changed or been copied incorrectly.

**Steps:**
1. In Supabase dashboard, click on your project
2. Click **Settings** (gear icon) in left sidebar
3. Click **Database**
4. Scroll to **"Connection string"** section
5. Click **"URI"** tab
6. **Copy the FULL string** (it should look like this):

```
postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

**Important notes:**
- Newer Supabase projects use a different format
- The host might be `.pooler.supabase.com` instead of just `.supabase.co`
- The port might be `6543` (pooling) instead of `5432` (direct)
- You need to replace `[YOUR-PASSWORD]` with your actual password

---

### 3. Update Your .env File

Open `.env` file and replace the DATABASE_URL line with your **exact** connection string from Supabase.

**Important for special characters in password:**
If your password contains special characters like `#`, `@`, `&`, `/`, etc., you need to URL-encode them:

| Character | URL-Encoded |
|-----------|-------------|
| `#` | `%23` |
| `@` | `%40` |
| `&` | `%26` |
| `/` | `%2F` |
| `?` | `%3F` |
| `=` | `%3D` |
| `%` | `%25` |

**Your current password:** `#Uchechukwu1991#`
**URL-encoded:** `%23Uchechukwu1991%23` ✅ (Already correct!)

---

### 4. Try Different Connection Formats

Supabase provides different connection modes. Try each one:

**Option A: Session Mode (Port 5432) - For migrations**
```env
DATABASE_URL="postgresql://postgres:%23Uchechukwu1991%23@db.jwhfowlouxmgvkdlgfit.supabase.co:5432/postgres"
```

**Option B: Transaction Mode (Port 6543) - Pooler**
```env
DATABASE_URL="postgresql://postgres:%23Uchechukwu1991%23@db.jwhfowlouxmgvkdlgfit.supabase.co:6543/postgres?pgbouncer=true"
```

**Option C: New Format (if your project is recent)**
Check Supabase dashboard for the exact format. It might be:
```env
DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
```

---

### 5. Verify Connection in Supabase Dashboard

1. In Supabase, go to **SQL Editor**
2. Run this test query:
```sql
SELECT version();
```
3. If this works, your database is running!

---

### 6. Check Your Internet/Firewall

**Test connection:**
```bash
# Windows Command Prompt
nslookup db.jwhfowlouxmgvkdlgfit.supabase.co
```

If this fails, check:
- Internet connection is working
- Corporate firewall isn't blocking Supabase
- VPN isn't interfering

---

## 🔧 Quick Fixes to Try

### Fix 1: Use Prisma Studio to Test

```bash
npm run prisma:studio
```

If this opens at http://localhost:5555 and shows your tables, the connection works!

### Fix 2: Test with Direct SQL

Create a test file `test-db.js`:

```javascript
const { PrismaClient } = require('./src/backend/generated/prisma');

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    console.log('✅ Connected to database!');
    const result = await prisma.$queryRaw`SELECT version()`;
    console.log('Database version:', result);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

Run it:
```bash
node test-db.js
```

### Fix 3: Copy String from Supabase Again

Sometimes the easiest fix is to:
1. Go back to Supabase Settings → Database
2. Copy the connection string again (fresh)
3. Make sure to:
   - Replace `[YOUR-PASSWORD]` with actual password
   - URL-encode special characters
   - Add `?schema=public` at the end if not present

---

## 📞 What to Check in Supabase

1. **Project Status:** Must be "Active" (green)
2. **Region:** Note the region (e.g., `us-east-1`)
3. **Database:** Should show "Healthy"
4. **Connection Limit:** Free tier = 60 connections

---

## ✅ Correct Connection String Format

Your connection string should look like ONE of these:

**Format 1 (Older projects):**
```
postgresql://postgres:PASSWORD@db.PROJECT-ID.supabase.co:5432/postgres?schema=public
```

**Format 2 (Newer projects with pooling):**
```
postgresql://postgres.PROJECT-REF:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
```

**Format 3 (Direct connection):**
```
postgresql://postgres:PASSWORD@db.PROJECT-ID.supabase.co:5432/postgres?schema=public
```

---

## 🚀 After Fixing

Once you have the correct connection string in `.env`:

```bash
# 1. Regenerate Prisma Client
npm run prisma:generate

# 2. Run migrations
npm run prisma:migrate

# 3. Verify with Prisma Studio
npm run prisma:studio
```

---

## Still Not Working?

### Alternative: Create New Supabase Project

Sometimes it's faster to create a fresh project:

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in details
4. Wait for setup (2-3 min)
5. Copy connection string
6. Update `.env`
7. Try again

**OR**

### Use Local PostgreSQL Instead

If Supabase continues to have issues:
1. Follow: [INSTALL_POSTGRESQL.md](INSTALL_POSTGRESQL.md)
2. Install PostgreSQL locally
3. Update DATABASE_URL in `.env` to local connection

---

## 📝 What to Send for Help

If you need support, provide:
- [ ] Screenshot of Supabase project dashboard (showing status)
- [ ] Your connection string (with password masked: `***`)
- [ ] Region of your Supabase project
- [ ] Output of: `npm run prisma:generate`
- [ ] Full error message from migration

---

**Need immediate help?** Check the Supabase status page: https://status.supabase.com
