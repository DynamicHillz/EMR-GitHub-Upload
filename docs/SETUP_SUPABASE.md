# Setting Up Supabase for SSMC EMR

This guide will help you set up a free PostgreSQL database using Supabase (no local installation needed!).

---

## Why Supabase?

- ✅ **Free PostgreSQL database** (up to 500MB)
- ✅ **No local installation** required
- ✅ **Managed & Secure** - automatic backups
- ✅ **Built-in tools** - SQL editor, table viewer
- ✅ **Perfect for development** and can scale to production

---

## Step 1: Create Supabase Account

### 1.1 Sign Up

1. Go to: **https://supabase.com**
2. Click **"Start your project"** or **"Sign In"**
3. Sign up with:
   - GitHub (recommended)
   - Or email

### 1.2 Create New Project

1. After signing in, click **"New Project"**
2. Fill in the details:
   - **Organization:** Create new or select existing
   - **Project Name:** `medflow-emr` (or any name you like)
   - **Database Password:** Generate a strong password
     - **IMPORTANT:** Copy and save this password somewhere safe!
     - You'll need it later
   - **Region:** Choose closest to you (e.g., `us-east-1` for USA)
   - **Pricing Plan:** Free (sufficient for development)

3. Click **"Create new project"**

4. **Wait 2-3 minutes** for project to be ready (you'll see a setup progress screen)

---

## Step 2: Get Database Connection String

Once your project is ready:

### 2.1 Navigate to Database Settings

1. In your Supabase dashboard, click on your project
2. Click **Settings** (gear icon) in the left sidebar
3. Click **Database**

### 2.2 Find Connection String

Scroll down to **"Connection string"** section and you'll see:

- **URI** - This is what we need!
- **Connection pooling** - Optional (use for production)

### 2.3 Copy the Connection String

Click on **"URI"** tab and copy the connection string. It looks like:

```
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

**IMPORTANT:** Replace `[YOUR-PASSWORD]` with the actual password you created in Step 1.2!

Example:
```
postgresql://postgres:mySecurePassword123@db.abcdefghijklmnop.supabase.co:5432/postgres
```

---

## Step 3: Configure SSMC EMR

### 3.1 Create .env File

In your project root directory, create a `.env` file:

```bash
# Copy from template
cp .env.example .env
```

Or create it manually.

### 3.2 Update Database URL

Open the `.env` file and update the `DATABASE_URL`:

```env
# Replace with your Supabase connection string
DATABASE_URL="postgresql://postgres:YOUR-PASSWORD@db.xxxxxxxxxxxxx.supabase.co:5432/postgres?schema=public"
```

Make sure to add `?schema=public` at the end!

**Full .env file example:**
```env
# Database - Supabase
DATABASE_URL="postgresql://postgres:myPassword123@db.abcdefg.supabase.co:5432/postgres?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_EXPIRY="8h"

# Application
NODE_ENV="development"
PORT=3000
API_BASE_URL="http://localhost:3000"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Sync Configuration
SYNC_INTERVAL_MS=900000
SYNC_BATCH_SIZE=100
SYNC_RETRY_ATTEMPTS=3
```

### 3.3 Generate a Secure JWT Secret

For the `JWT_SECRET`, generate a random string:

**Option 1 - Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Option 2 - Online:**
Visit: https://www.uuidgenerator.net/

Copy the generated string and use it as your `JWT_SECRET`.

---

## Step 4: Initialize Database

Now that Supabase is configured, let's set up the database schema:

### 4.1 Generate Prisma Client

```bash
npm run prisma:generate
```

This creates the TypeScript types for your database models.

### 4.2 Run Migrations

```bash
npm run prisma:migrate
```

When prompted for a migration name, enter:
```
initial_setup
```

This will create all the tables in your Supabase database!

### 4.3 Verify in Supabase Dashboard

1. Go back to your Supabase project
2. Click **"Table Editor"** in the left sidebar
3. You should see all your tables:
   - `tenants`
   - `users`
   - `patients`
   - `appointments`
   - `consultations`
   - And many more!

---

## Step 5: Test Connection

### 5.1 Open Prisma Studio

```bash
npm run prisma:studio
```

This opens a visual database editor at: **http://localhost:5555**

You should see all your tables listed. If you see them, the connection is working!

### 5.2 Test with Backend Server

Start the backend:

```bash
npm run dev:backend
```

You should see:
```
🚀 SSMC EMR Server running on port 3000
📝 Environment: development
🔗 API: http://localhost:3000/api
❤️  Health Check: http://localhost:3000/health
```

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

Or open in browser: http://localhost:3000/health

---

## Step 6: Start Development

Now you're ready to develop! Open two terminals:

### Terminal 1 - Backend
```bash
npm run dev:backend
```
Runs on: http://localhost:3000

### Terminal 2 - Frontend
```bash
npm run dev:frontend
```
Runs on: http://localhost:5173

Open your browser to: **http://localhost:5173**

---

## 🎉 You're All Set!

Your SSMC EMR is now connected to a cloud PostgreSQL database via Supabase!

---

## Useful Supabase Features

### SQL Editor
1. In Supabase dashboard, click **"SQL Editor"**
2. Write and run SQL queries
3. View query results

Example query:
```sql
-- View all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public';

-- Count patients
SELECT COUNT(*) FROM patients;
```

### Table Editor
- Visual interface to view/edit data
- Add/edit/delete rows
- Useful for testing

### Database Backups
- Free plan: Daily backups (7 days retention)
- Access via: Settings → Database → Backups

---

## Common Issues

### "Connection refused" or "Can't reach database"

**Solution 1:** Check your connection string
- Ensure password is correct (no `[YOUR-PASSWORD]` placeholder)
- Ensure you added `?schema=public` at the end

**Solution 2:** Check Supabase project status
- Go to Supabase dashboard
- Ensure project is "Active" (not paused)

### "Too many connections"

Free tier limit: 60 connections

**Solution:** Add connection pooling to your DATABASE_URL:
```env
DATABASE_URL="postgresql://postgres:password@db.xxx.supabase.co:6543/postgres?schema=public&pgbouncer=true"
```
Note: Port changes from `5432` to `6543` with pooling

### Migrations fail

**Solution:** Reset and retry:
```bash
# Drop all tables (WARNING: deletes data!)
npm run prisma:migrate reset

# Run migrations again
npm run prisma:migrate
```

---

## Security Best Practices

### ✅ DO:
- Keep your `.env` file secret (it's already in `.gitignore`)
- Use a strong database password
- Generate a random JWT_SECRET
- Use connection pooling for production

### ❌ DON'T:
- Commit `.env` file to Git
- Share your database password
- Use simple passwords like "password123"
- Hardcode credentials in code

---

## Supabase Free Tier Limits

| Resource | Limit |
|----------|-------|
| Database Size | 500 MB |
| Bandwidth | 5 GB |
| API Requests | Unlimited (with fair use) |
| Edge Functions | 500K invocations/month |
| Storage | 1 GB |

**Perfect for development!** Upgrade when needed for production.

---

## Next Steps

1. **Start building features:**
   - Implement user authentication
   - Create patient registration
   - Build appointment system

2. **Explore the codebase:**
   - Backend: `src/backend/`
   - Frontend: `src/frontend/`
   - Schema: `prisma/schema.prisma`

3. **Read documentation:**
   - [README.md](README.md)
   - [QUICKSTART.md](QUICKSTART.md)
   - [PROJECT_STATUS.md](PROJECT_STATUS.md)

---

## Useful Commands

```bash
# Database Management
npm run prisma:studio        # Visual database editor
npm run prisma:generate      # Generate Prisma Client
npm run prisma:migrate       # Run migrations
npm run prisma:migrate reset # Reset database (caution!)

# Development
npm run dev:backend          # Start backend server
npm run dev:frontend         # Start frontend app

# Code Quality
npm run lint                 # Check code quality
npm run format               # Format code
```

---

## Resources

- **Supabase Docs:** https://supabase.com/docs
- **Prisma Docs:** https://www.prisma.io/docs
- **Supabase Dashboard:** https://app.supabase.com

---

**Need Help?**

Check the [troubleshooting section](#common-issues) above or review the SSMC EMR documentation files.

---

**Happy Coding! 🚀**
