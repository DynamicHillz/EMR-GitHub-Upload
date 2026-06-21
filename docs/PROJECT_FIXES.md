# Project Reorganization & Fixes

## Issues Identified and Fixed

### 1. Database Connection Pooling Issue ✅

**Problem**: "Prepared statement already exists" error when using Supabase connection pooler

**Root Cause**: Prisma prepared statements don't work well with PgBouncer connection pooling

**Solution**: Added `?pgbouncer=true` to DATABASE_URL in `.env`

```bash
# Before
DATABASE_URL="postgresql://postgres.rzikblrxvdxsxyipqkdy:%23Uchechukwu1991%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"

# After
DATABASE_URL="postgresql://postgres.rzikblrxvdxsxyipqkdy:%23Uchechukwu1991%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

### 2. Multiple Node.js Processes ✅

**Problem**: Multiple node processes accumulating, causing database connection conflicts

**Root Cause**: Background processes started by various tools weren't properly terminated

**Solution**: Created [start-clean.bat](start-clean.bat) that:
- Kills all existing node.exe processes
- Starts backend in dedicated window
- Starts frontend in dedicated window
- Prevents multiple instances

### 3. Error Handling - Frontend ✅

**Problem**: Raw error messages and code shown to users

**Solution**:
- Created [ErrorAlert component](src/frontend/components/common/ErrorAlert.tsx) for consistent error display
- Created [error handler utilities](src/frontend/utils/errorHandler.ts) for extracting user-friendly messages
- Updated [LoginPage.tsx](src/frontend/pages/LoginPage.tsx:68-76) to use ErrorAlert
- Updated [CreateUserPage.tsx](src/frontend/pages/users/CreateUserPage.tsx:68-76) to use ErrorAlert
- Updated [AuthContext.tsx](src/frontend/contexts/AuthContext.tsx) to extract messages from API responses

### 4. Error Handling - Backend ✅

**Problem**: Technical error messages exposed to users

**Solution**: Updated [errorHandler.ts](src/backend/presentation/middleware/errorHandler.ts) with `getUserFriendlyMessage()` function that maps:
- Database constraint errors → "This email address is already registered"
- Authentication errors → "Invalid email or password"
- Network errors → "Unable to connect to the server"
- etc.

## Project Structure

```
St.stephen EMR/
├── src/
│   ├── backend/                    # Backend (Node.js + Express + Prisma)
│   │   ├── domain/                 # Business logic (no dependencies)
│   │   ├── application/            # Use cases + DTOs + validators
│   │   ├── infrastructure/         # Database, external services
│   │   ├── presentation/           # Controllers, routes, middleware
│   │   ├── config/                 # Configuration
│   │   └── server.ts               # Entry point
│   │
│   └── frontend/                   # Frontend (React + TypeScript + Vite)
│       ├── components/             # Reusable UI components
│       │   ├── common/            # ErrorAlert, etc.
│       │   ├── layout/            # MainLayout
│       │   └── ...                # Domain-specific components
│       ├── pages/                  # Top-level pages
│       ├── contexts/               # React Context (Auth, etc.)
│       ├── services/               # API services
│       ├── utils/                  # Utilities (errorHandler, etc.)
│       └── App.tsx                 # Router
│
├── prisma/
│   └── schema.prisma              # Database schema (110+ models)
│
├── .env                           # Environment configuration
├── start-clean.bat                # Startup script (RECOMMENDED)
├── HOW_TO_START.md               # Startup guide
├── CLAUDE.md                      # Project overview for AI
└── package.json                   # Dependencies
```

## Architecture Principles

### Backend - Clean Architecture

```
Presentation (HTTP) → Application (Use Cases) → Domain (Business Logic) → Infrastructure (Database)
```

**Dependency Rule**: Dependencies point inward (Infrastructure depends on Domain, not vice versa)

**Key Patterns**:
- DTOs for data transfer across boundaries
- Repository pattern for database access
- Service layer for complex business logic
- Middleware for cross-cutting concerns (auth, logging, error handling)

### Frontend - Component-Based

**Stack**:
- React 18 + TypeScript
- React Router for navigation
- Axios for HTTP requests
- Tailwind CSS for styling
- React Hook Form for forms

**Error Handling Flow**:
```
API Error → AuthContext/Service → Extract Message → ErrorAlert Component → User sees friendly message
```

## Configuration

### Environment Variables (.env)

**Critical Settings**:
```bash
# Database (Supabase with pgbouncer)
DATABASE_URL="postgresql://...?pgbouncer=true"  # Connection pooling
DIRECT_URL="postgresql://..."                    # For migrations

# JWT
JWT_SECRET="..."
JWT_EXPIRY="8h"

# Application
NODE_ENV="development"
PORT=3000
```

### Prisma Configuration

**Location**: `prisma/schema.prisma`

**Key Features**:
- 110+ models for comprehensive EMR functionality
- Multi-tenancy via `tenantId` on all models
- Enums for status fields (UserRole, AppointmentStatus, etc.)
- Audit logging for compliance

**After schema changes**:
```bash
npx prisma generate           # Regenerate client
npx prisma db push            # Push to database (dev)
# OR
npx prisma migrate dev        # Create migration (production)
```

## Startup Procedures

### Recommended Method

**Double-click [start-clean.bat](start-clean.bat)**

This is the ONLY recommended way to start the servers. It ensures:
- No conflicting processes
- Clean startup every time
- Proper window management

### Manual Method (If needed)

1. Kill existing processes:
   ```bash
   taskkill /F /IM node.exe
   ```

2. Terminal 1 - Backend:
   ```bash
   cd "c:\Users\WINDOWS11\Documents\PythonProject\St.stephen EMR"
   npm run dev:backend
   ```

3. Terminal 2 - Frontend:
   ```bash
   cd "c:\Users\WINDOWS11\Documents\PythonProject\St.stephen EMR"
   npm run dev:frontend
   ```

## Testing

Access the application at http://localhost:5173

**Login Credentials**:
```
Email: admin@hospital.com
Password: Admin@123
```

**Test User Creation**:
1. Navigate to User Management
2. Click "Create User"
3. Fill in form with valid data
4. Should see user created successfully

## Troubleshooting

### Prepared Statement Error

**Symptom**: "prepared statement 's0' already exists"

**Fix**:
1. Close all terminals
2. Run `taskkill /F /IM node.exe`
3. Use [start-clean.bat](start-clean.bat)

### Login Fails

**Check**:
- Backend running? (should see "Server running on port 3000")
- Database connected? (should see "Database connected successfully")
- Correct credentials? (see above)

### User Creation Hangs

**Cause**: Usually multiple node processes

**Fix**: Use [start-clean.bat](start-clean.bat) to restart cleanly

## Next Steps

### Completed ✅
- [x] Database connection pooling configured
- [x] Error handling (frontend + backend)
- [x] Startup scripts
- [x] Documentation

### To Do
- [ ] Complete pharmacy module (currently disabled)
- [ ] Implement offline sync engine
- [ ] Add Electron desktop app
- [ ] Implement SQLite local database
- [ ] Add API documentation (Swagger)
- [ ] Complete test coverage

## Resources

- **Setup Guide**: [HOW_TO_START.md](HOW_TO_START.md)
- **Project Overview**: [CLAUDE.md](CLAUDE.md)
- **Main README**: [README.md](README.md)
- **Database Schema**: [prisma/schema.prisma](prisma/schema.prisma)

## Summary

The project has been reorganized and fixed to:
1. ✅ Handle database connection pooling properly
2. ✅ Prevent multiple process conflicts
3. ✅ Show user-friendly error messages
4. ✅ Provide reliable startup procedures
5. ✅ Document everything for future maintenance

All core functionality (login, user creation, patient management, appointments, billing) should now work correctly.
