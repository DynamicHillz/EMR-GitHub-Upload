# Supabase Setup - Quick Checklist ✅

Follow these steps in order. Check off each step as you complete it.

---

## ☑️ Step 1: Create Supabase Account

- [ ] Go to https://supabase.com
- [ ] Click "Start your project"
- [ ] Sign up with GitHub or Email
- [ ] Verify your email (if required)

**Time:** 2 minutes

---

## ☑️ Step 2: Create New Project

- [ ] Click "New Project" in Supabase dashboard
- [ ] Choose/create organization
- [ ] Enter project details:
  - Name: `medflow-emr`
  - Database Password: (Generate and **SAVE THIS!**)
  - Region: (Choose closest to you)
  - Plan: Free
- [ ] Click "Create new project"
- [ ] Wait 2-3 minutes for setup to complete

**Time:** 3-5 minutes

**Important:** Save your database password somewhere safe!

---

## ☑️ Step 3: Get Connection String

- [ ] In Supabase dashboard, click **Settings** (gear icon)
- [ ] Click **Database**
- [ ] Scroll to "Connection string" section
- [ ] Click **"URI"** tab
- [ ] Copy the connection string
- [ ] Replace `[YOUR-PASSWORD]` with your actual password

Your connection string should look like:
```
postgresql://postgres:myPassword123@db.abcdefghijk.supabase.co:5432/postgres
```

**Time:** 1 minute

---

## ☑️ Step 4: Configure SSMC EMR

### 4.1 Create .env file

- [ ] In your project folder, copy `.env.example` to `.env`

**Windows Command Prompt:**
```bash
copy .env.example .env
```

**Or create manually:**
- [ ] Right-click in project folder
- [ ] New → Text Document
- [ ] Name it `.env` (delete the .txt extension)

### 4.2 Update DATABASE_URL

- [ ] Open `.env` file in any text editor
- [ ] Find the line starting with `DATABASE_URL=`
- [ ] Replace it with your Supabase connection string
- [ ] **Important:** Add `?schema=public` at the end!

Example:
```env
DATABASE_URL="postgresql://postgres:myPassword@db.xxx.supabase.co:5432/postgres?schema=public"
```

### 4.3 Generate JWT Secret

- [ ] Open a terminal in your project folder
- [ ] Run this command:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
- [ ] Copy the output
- [ ] In `.env` file, replace `JWT_SECRET` value with the copied text

**Time:** 3 minutes

---

## ☑️ Step 5: Initialize Database

Open a terminal in your project folder and run:

### 5.1 Generate Prisma Client
```bash
npm run prisma:generate
```
- [ ] Wait for completion (should see "Generated Prisma Client")

### 5.2 Run Migrations
```bash
npm run prisma:migrate
```
- [ ] When asked for migration name, type: `initial_setup`
- [ ] Press Enter
- [ ] Wait for completion

**Time:** 2-3 minutes

---

## ☑️ Step 6: Verify Setup

### 6.1 Check Tables in Supabase

- [ ] Go back to Supabase dashboard
- [ ] Click "Table Editor" in left sidebar
- [ ] You should see tables like:
  - tenants
  - users
  - patients
  - appointments
  - consultations
  - etc.

### 6.2 Test with Prisma Studio

- [ ] In terminal, run:
```bash
npm run prisma:studio
```
- [ ] Browser should open to http://localhost:5555
- [ ] You should see all your database tables

If you see the tables, **SUCCESS!** ✅

**Time:** 2 minutes

---

## ☑️ Step 7: Start Development Servers

Open **TWO** terminal windows in your project folder:

### Terminal 1 - Backend
```bash
npm run dev:backend
```
- [ ] Wait for "Server running on port 3000" message
- [ ] Leave this terminal running

### Terminal 2 - Frontend
```bash
npm run dev:frontend
```
- [ ] Wait for "Local: http://localhost:5173" message
- [ ] Leave this terminal running

**Time:** 1 minute

---

## ☑️ Step 8: Open Application

- [ ] Open your browser
- [ ] Go to: http://localhost:5173
- [ ] You should see the SSMC EMR login page

**CONGRATULATIONS! 🎉 Your setup is complete!**

---

## 📋 Quick Reference

### Your Credentials

Database: Supabase PostgreSQL
- **Dashboard:** https://app.supabase.com
- **Project:** (your project name)
- **Password:** (the one you saved in Step 2)

Application URLs:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **API Health:** http://localhost:3000/health
- **Prisma Studio:** http://localhost:5555 (when running)

---

## 🆘 Troubleshooting

### Can't see tables in Supabase after migration?

**Solution:**
```bash
npm run prisma:migrate reset
npm run prisma:migrate
```

### "Connection refused" error?

**Solution:** Check your DATABASE_URL in `.env`:
- Password is correct (no `[YOUR-PASSWORD]` placeholder)
- Contains `?schema=public` at the end
- No extra spaces or quotes

### Backend won't start?

**Solution:**
```bash
# Make sure dependencies are installed
npm install

# Try regenerating Prisma Client
npm run prisma:generate
```

---

## 🎯 Next Steps

Now that everything is set up, you can:

1. **Start developing features**
   - User authentication (Sprint 1)
   - Patient registration (Sprint 1)
   - Appointment scheduling (Sprint 9-10)

2. **Explore the codebase**
   - Backend: `src/backend/`
   - Frontend: `src/frontend/`
   - Database: `prisma/schema.prisma`

3. **Read documentation**
   - [SETUP_SUPABASE.md](SETUP_SUPABASE.md) - Detailed Supabase guide
   - [README.md](README.md) - Project overview
   - [QUICKSTART.md](QUICKSTART.md) - Development guide
   - [PROJECT_STATUS.md](PROJECT_STATUS.md) - Feature tracker

---

## 📞 Helpful Commands

```bash
# Development
npm run dev:backend          # Start backend server
npm run dev:frontend         # Start frontend app

# Database
npm run prisma:studio        # Visual DB editor
npm run prisma:generate      # Regenerate Prisma Client
npm run prisma:migrate       # Create/run migrations

# Code Quality
npm run lint                 # Check code
npm run format               # Format code
```

---

**Total Setup Time:** ~15 minutes

**Ready to code!** 🚀
