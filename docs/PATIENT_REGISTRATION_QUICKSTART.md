# Patient Registration Quick Start Guide

## Problem
You're unable to register patients because:
1. **Patient registration requires authentication** (you must be logged in)
2. **You don't have any users yet** to login with
3. **You need a tenant** before creating users

## Solution: Create Initial Data

### Step 1: Create Tenant and Admin User

Run the SQL script to create your first tenant and admin user:

```bash
# Connect to your PostgreSQL database
psql -U postgres -d your_database_name -f create-initial-data.sql
```

**Or using Supabase SQL Editor:**
1. Go to your Supabase project dashboard
2. Click on **SQL Editor** in the left sidebar
3. Open the file `create-initial-data.sql`
4. Copy and paste the entire SQL content
5. Click **Run**

This will create:
- **Tenant**: St. Stephen Hospital (slug: `st-stephen-hospital`)
- **Admin User**:
  - Email: `admin@hospital.com`
  - Password: `Admin@123`

### Step 2: Get Your Tenant ID

After running the SQL, the tenant ID will be displayed. **Copy this ID** - you'll need it for login.

Alternatively, you can query it:

```sql
SELECT id, name, slug FROM "Tenant" WHERE slug = 'st-stephen-hospital';
```

### Step 3: Login to Get Authentication Token

Now you can login via the API or frontend:

#### Option A: Login via Frontend
1. Open your browser to `http://localhost:5173`
2. You should see the login page
3. Enter:
   - **Email**: `admin@hospital.com`
   - **Password**: `Admin@123`
   - **Tenant ID**: (the UUID from Step 2)
4. Click **Login**

#### Option B: Login via API (for testing)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@hospital.com",
    "password": "Admin@123",
    "tenantId": "YOUR-TENANT-ID-HERE"
  }'
```

This will return:
```json
{
  "message": "Login successful",
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "..."
}
```

**Copy the `token` value** - this is your authentication token.

### Step 4: Register a Patient

Now you can register patients! You need to include the authentication token in the request.

#### Option A: Register via Frontend (Recommended)
1. After logging in, you'll be redirected to the dashboard
2. Click on **Patients** in the sidebar
3. Click **Register New Patient**
4. Fill in the patient information
5. Click **Submit**

#### Option B: Register via API
```bash
curl -X POST http://localhost:3000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR-TOKEN-HERE" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1990-01-15",
    "gender": "MALE",
    "phone": "+1234567890",
    "email": "john.doe@example.com",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    }
  }'
```

## Common Issues

### Issue 1: "No authentication token provided"
**Solution**: You forgot to login. Go back to Step 3 and login first.

### Issue 2: "Invalid tenant ID format"
**Solution**: Make sure you're using the actual UUID from the database, not "default-tenant" or any other string.

### Issue 3: "Email already registered"
**Solution**: The admin user already exists. Just login with the credentials above.

### Issue 4: Frontend shows "Login failed"
**Possible causes**:
1. Backend server is not running - Check that you see "Server running on port 3000" in your terminal
2. Wrong credentials - Make sure you're using `admin@hospital.com` and `Admin@123`
3. Wrong tenant ID - Double-check the UUID from the database

## Verification

To verify everything is working:

1. **Check backend is running**:
   ```bash
   curl http://localhost:3000/health
   ```
   Should return: `{"status":"healthy",...}`

2. **Check you can login**:
   ```bash
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@hospital.com","password":"Admin@123","tenantId":"YOUR-TENANT-ID"}'
   ```
   Should return a token.

3. **Check you can register patients** (using the token from step 2):
   ```bash
   curl -X POST http://localhost:3000/api/patients \
     -H "Authorization: Bearer YOUR-TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"firstName":"Test","lastName":"Patient","dateOfBirth":"1990-01-01","gender":"MALE","phone":"1234567890"}'
   ```
   Should return the created patient data.

## Summary

**The workflow is**:
1. ✅ Backend server running (port 3000)
2. ✅ Create tenant and admin user (SQL script)
3. ✅ Login to get authentication token
4. ✅ Use token to register patients

**You cannot register patients without being logged in!** This is by design for security - all patient data operations require authentication.
