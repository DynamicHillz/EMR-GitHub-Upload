# Fresh Database Setup Guide

## Step 1: Update .env file

Update your `.env` file with the NEW database connection strings from Supabase:

```env
# Supabase Pooling Connection (use for queries - port 6543)
DATABASE_URL="postgresql://postgres.XXXXX:YOUR-PASSWORD@aws-X-XX-XXXX-X.pooler.supabase.com:6543/postgres"

# Supabase Direct Connection (use for migrations/schema - port 5432)
DIRECT_URL="postgresql://postgres.XXXXX:YOUR-PASSWORD@aws-X-XX-XXXX-X.pooler.supabase.com:5432/postgres"
```

Replace with your actual connection strings from the new Supabase project.

## Step 2: Run the automated setup

After updating .env, run:

```bash
node fresh-setup.js
```

This script will:
1. Push the Prisma schema to create all tables
2. Create a default tenant
3. Create an admin user
4. Display your login credentials

## Step 3: Login

Use the credentials displayed by the script to login at http://localhost:5173

---

**Need help?** Make sure both servers are running:
- Backend: `npm run dev:backend`
- Frontend: `npm run dev:frontend`
