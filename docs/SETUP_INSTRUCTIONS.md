# Quick Setup Instructions

The Prisma client is having issues running setup scripts because of prepared statement conflicts with the database.

## **Easiest Solution: Use Supabase SQL Editor**

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Copy and Run the SQL Script
1. Open the file: `setup-supabase.sql` in this project
2. Copy ALL the contents
3. Paste into the Supabase SQL Editor
4. Click "Run" or press Ctrl+Enter

### Step 3: Copy Your Tenant ID
After running the script, you'll see output like this:
```
Tenant ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Tenant Name: St. Stephen Hospital
Tenant Slug: st-stephen-hospital
```

**IMPORTANT**: Copy the entire Tenant ID UUID from the output.

### Step 4: Login to the Application
1. Go to: http://localhost:5173
2. Use these credentials:
   - **Tenant ID**: [Paste the UUID you copied]
   - **Email**: `admin@hospital.com`
   - **Password**: `Admin@123`

### Step 5: Start Using the System
After logging in, you can:
- Register new patients
- Create appointments
- Manage billing
- And all other features

---

## Troubleshooting

### If you don't see the Tenant ID in the output:
Run this query in Supabase SQL Editor:
```sql
SELECT id as "Tenant ID", name as "Tenant Name"
FROM "Tenant"
WHERE slug = 'st-stephen-hospital';
```

### If login still fails:
1. Make sure you copied the EXACT Tenant ID (it's a UUID like: `550e8400-e29b-41d4-a716-446655440000`)
2. Make sure you're using the exact email: `admin@hospital.com`
3. Make sure you're using the exact password: `Admin@123`
4. Check that both frontend (port 5173) and backend (port 3000) servers are running

---

## Current Server Status
- **Frontend**: Should be running on http://localhost:5173
- **Backend**: Should be running on http://localhost:3000

If either is not running, start them with:
```bash
npm run dev:frontend
npm run dev:backend
```
