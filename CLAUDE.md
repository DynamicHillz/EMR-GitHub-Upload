# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SSMC EMR is an offline-first Electronic Medical Records system for private clinics in emerging markets. It's built as an Electron desktop application with cloud synchronization capabilities, supporting complete clinical workflows from patient registration through billing.

**Key Characteristics**:
- Multi-tenant SaaS supporting 100+ independent clinics
- Offline-first with bi-directional cloud sync
- PostgreSQL (cloud via Supabase) + SQLite (local with SQLCipher encryption)
- 7 user roles: Admin, Doctor, Nurse, Lab Tech, Pharmacist, Cashier, Receptionist
- 110+ Prisma models covering comprehensive healthcare workflows

## Development Commands

### Backend Development
```bash
npm run dev:backend          # Start backend dev server (port 3000)
npm run build:backend        # Compile TypeScript backend
```

### Frontend Development
```bash
npm run dev:frontend         # Start Vite dev server (port 5173)
npm run build:frontend       # Build frontend for production
```

### Database Operations
```bash
npm run prisma:generate      # Generate Prisma client (required after schema changes)
npm run prisma:migrate       # Run database migrations
npm run prisma:studio        # Open Prisma Studio GUI
npm run db:seed              # Seed database with test data
```

### Electron Desktop App
```bash
npm run dev:electron         # Run Electron app in development
npm run build:electron       # Build desktop installers (Windows/Mac/Linux)
```

### Code Quality
```bash
npm run lint                 # Run ESLint on .ts and .tsx files
npm run format               # Format code with Prettier
npm test                     # Run Jest tests
```

## Architecture

### Backend: Clean Architecture (Layered)

The backend follows Clean Architecture principles with strict separation of concerns and dependency inversion. **All dependencies point inward** toward the domain layer.

```
src/backend/
├── domain/                    # Core business logic (NO dependencies)
│   ├── entities/             # Domain entities with business methods
│   ├── interfaces/           # Repository contracts (implemented by infrastructure)
│   └── services/             # Complex business rules
│
├── application/              # Use cases/orchestration (depends on: domain)
│   ├── dtos/                # Data Transfer Objects
│   ├── use-cases/           # Application-specific business workflows
│   └── validators/          # Joi/Zod validation schemas
│
├── infrastructure/          # External concerns (depends on: domain, application)
│   ├── database/
│   │   ├── prisma.client.ts
│   │   └── repositories/    # Implements domain interfaces
│   ├── external/            # SMS, email, payment integrations
│   ├── cache/               # Caching layer
│   └── generators/          # ID generation, etc.
│
├── presentation/            # HTTP/API layer (depends on: application, domain)
│   ├── controllers/         # HTTP request handlers
│   ├── routes/              # Express route definitions
│   └── middleware/          # Auth, validation, error handling
│
├── shared/                  # Cross-cutting utilities (no dependencies)
│   ├── utils/               # Date, string utilities
│   ├── constants/           # HTTP status codes, error messages
│   ├── types/               # Shared TypeScript types
│   └── errors/              # AppError class
│
├── config/                  # Configuration (logger, database, env)
└── server.ts               # Express app entry point
```

**Critical Architecture Rules**:
1. Domain layer has ZERO external dependencies
2. Infrastructure implements interfaces defined in domain
3. Use cases coordinate domain entities and repositories
4. Controllers delegate to use cases, never directly to repositories
5. Always use DTOs when crossing layer boundaries

### Frontend: React with Component-Based Structure

```
src/frontend/
├── App.tsx                  # Router and route definitions
├── main.tsx                 # React app entry point
├── components/              # Reusable UI components
│   ├── layout/              # MainLayout with navigation
│   ├── appointments/        # Appointment-specific components
│   ├── consultations/       # Consultation forms and modals
│   ├── lab/                 # Lab test components
│   └── ...                  # Other domain-specific components
└── pages/                   # Top-level page components
    ├── DashboardPage.tsx
    ├── PatientsPage.tsx
    ├── AppointmentsPage.tsx
    ├── ConsultationsPage.tsx
    ├── LabPage.tsx
    ├── PharmacyPage.tsx
    ├── BillingPage.tsx
    └── billing/             # Nested billing pages
```

**Frontend Stack**:
- React 18 + TypeScript
- React Router v6 for navigation
- React Query for data fetching/caching
- Zustand for state management
- Tailwind CSS for styling
- React Hook Form for form handling
- Lucide React for icons
- React Big Calendar for scheduling

### Path Aliases (configured in tsconfig.json and vite.config.ts)

```typescript
@/*          → src/*
@backend/*   → src/backend/*
@frontend/*  → src/frontend/*
@shared/*    → src/shared/*
```

## Database Architecture

### Prisma Schema Location
- Schema: `prisma/schema.prisma`
- Generated client: `node_modules/@prisma/client` (default location)
- **Critical**: Schema uses `directUrl = env("DIRECT_URL")` for migrations to avoid pooler connection issues

### Key Models & Relationships

**Multi-tenancy**: All models include `tenantId` for data isolation
- `Tenant` → owns all clinic data

**Core Clinical Workflow**:
```
Patient → Appointment → Consultation → Prescription/LabTest
                                    → Invoice → Payment
```

**Sync Architecture**:
- `SyncDevice`: Device registration and authentication tokens
- `SyncQueue`: Tracks pending changes with conflict detection
- `AuditLog`: 7-year retention for compliance (GDPR/NDPR)

### Important Schema Considerations

1. **Prisma Client Location**: Generated to default `node_modules/@prisma/client`
2. **Always run after schema changes**: `npx prisma generate`
3. **Database Connection Requirements**:
   - `DATABASE_URL`: Supabase connection pooler (port 6543) - used for application queries
   - `DIRECT_URL`: Direct connection (port 5432) - required for migrations and schema changes
   - Both URLs must be properly configured in `.env` with URL-encoded passwords (`#` becomes `%23`)
4. **Enum Types**: Heavily used for status fields (e.g., `AppointmentStatus`, `UserRole`)
5. **Soft Deletes**: Some models use `deletedAt` instead of hard deletes
6. **Timestamps**: All models have `createdAt` and `updatedAt`

## Adding New Features

Follow this order when implementing new features:

### 1. Update Database Schema
```bash
# Edit prisma/schema.prisma
npm run prisma:generate
npm run prisma:migrate
```

### 2. Domain Layer (if complex business logic)
```typescript
// domain/entities/Feature.entity.ts
// domain/interfaces/IFeatureRepository.ts
// domain/services/feature.service.ts (if needed)
```

### 3. Application Layer
```typescript
// application/dtos/feature/CreateFeature.dto.ts
// application/validators/feature.validator.ts
// application/use-cases/feature/create-feature.use-case.ts
```

### 4. Infrastructure Layer
```typescript
// infrastructure/database/repositories/feature.repository.ts
```

### 5. Presentation Layer
```typescript
// presentation/controllers/feature.controller.ts
// presentation/routes/feature.routes.ts
// Update server.ts to register routes
```

### 6. Frontend
```typescript
// frontend/pages/FeaturePage.tsx
// frontend/components/feature/FeatureModal.tsx
// Update App.tsx to add route
```

## Utility Scripts

The project includes several Node.js scripts in the root directory for database management:

- **`wipe-database.js`**: Drops all tables, enums, and functions (use for fresh start)
- **`final-create-admin.js`**: Creates initial tenant and admin user after schema is set up
- **`check-tables.js`**: Lists all tables and inspects table structures
- **`list-tenants.js`**: Shows existing tenants and users in the database
- **`verify-user.js`**: Verifies specific user exists and shows their data

These scripts connect directly via PostgreSQL client (bypassing Prisma) and are useful for troubleshooting database issues.

## Environment Configuration

### Required Environment Variables

See `.env.example` for full list. Critical variables:

```bash
# Database
DATABASE_URL="postgresql://postgres:PASSWORD@db.XXX.supabase.co:5432/postgres"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRY="8h"

# Application
NODE_ENV="development"
PORT=3000

# Tenant
DEFAULT_TENANT_ID="clinic-001"

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Sync
SYNC_INTERVAL_MS=900000  # 15 minutes
```

### Database Setup (Supabase)

The project uses Supabase (free PostgreSQL hosting) for cloud database.

**Initial Setup Process:**

1. **Create Supabase Project**
   - Create account at https://supabase.com
   - Create new project
   - Go to Settings → Database → Connection String

2. **Configure Environment Variables**
   - Copy **Connection pooling** string (port 6543) → `DATABASE_URL` in `.env`
   - Copy **Direct connection** string (port 5432) → `DIRECT_URL` in `.env`
   - **Important**: URL-encode special characters in password (e.g., `#` becomes `%23`)

3. **Initialize Database Schema**
   ```bash
   # Wipe any existing data (if needed)
   node wipe-database.js

   # Push Prisma schema to create all tables
   npx prisma db push --accept-data-loss

   # Create initial tenant and admin user
   node final-create-admin.js
   ```

4. **Start Development Servers**
   ```bash
   npm run dev:backend   # Terminal 1
   npm run dev:frontend  # Terminal 2
   ```

**Login Credentials:** The setup script will display the tenant ID and admin credentials needed to login.

Alternative: Local PostgreSQL (see `INSTALL_POSTGRESQL.md`)

## API Architecture

### Request Flow
```
HTTP Request
  → Express Middleware (rate limit, CORS, helmet)
  → Authentication Middleware (JWT validation)
  → Route Handler
  → Controller
  → Use Case
  → Domain Service (if needed)
  → Repository
  → Prisma Client
  → PostgreSQL
```

### Authentication
- All routes except `/api/auth/*` require JWT authentication
- JWT stored in `Authorization: Bearer <token>` header
- Middleware: `src/backend/presentation/middleware/auth.ts`
- Token expiry: 8 hours (configurable via `JWT_EXPIRY`)

### Error Handling
- Custom `AppError` class in `src/backend/shared/errors/AppError.ts`
- Global error handler: `src/backend/presentation/middleware/errorHandler.ts`
- Always returns consistent JSON error format

### API Routes
```
/health                          # Health check (no auth required)
/api/auth/login                  # Login (no auth required)
/api/patients/*                  # Patient management
/api/appointments/*              # Scheduling
/api/consultations/*             # SOAP notes, vital signs
/api/prescriptions/*             # E-prescribing
/api/lab/*                       # Lab orders and results
/api/pharmacy/*                  # Medication dispensing (currently disabled)
/api/billing/*                   # Invoicing and payments
/api/sync/*                      # Sync operations
/api/users/*                     # User management
```

## Offline Sync Strategy

### Sync Flow
1. **Local-first**: All CRUD operations hit local SQLite first
2. **Queue for sync**: Changes added to `SyncQueue` table
3. **Periodic sync**: Every 15 minutes (configurable)
4. **Conflict detection**: Checksums + last-modified timestamps
5. **Conflict resolution**: Last-write-wins or manual resolution UI

### Sync Components
- `SyncDevice`: Registers each clinic laptop with unique token
- `SyncQueue`: Priority-based queue (prescriptions > routine updates)
- Sync routes: `src/backend/presentation/routes/sync.routes.ts`

## TypeScript Configuration

### Two Separate tsconfig Files

1. **Frontend**: `tsconfig.json`
   - Target: ES2020
   - Module: ESNext (for Vite)
   - JSX: react-jsx
   - No emit (Vite handles bundling)

2. **Backend**: `tsconfig.backend.json`
   - Target: ES2020
   - Module: CommonJS (for Node.js)
   - Output: `dist/backend`
   - Root: `src/backend`

### Important TypeScript Notes
- Strict mode enabled on both
- Path aliases configured in both tsconfig files AND vite.config.ts
- Backend uses CommonJS, frontend uses ESNext modules

## Security Features

- **Rate Limiting**: 100 requests/minute per IP (configurable)
- **Helmet.js**: Security headers (CSP, XSS protection)
- **CORS**: Configured for frontend URL only
- **bcrypt**: Password hashing with cost factor 12
- **JWT**: 8-hour token expiration
- **SQL Injection Prevention**: Prisma ORM parameterized queries
- **Input Validation**: Joi validators in application layer

## Known Issues & Technical Debt

1. **Pharmacy routes temporarily disabled**: TypeScript errors in pharmacy module (see comment in `server.ts:17,81`)
2. **Electron app**: Not yet implemented (marked as TODO)
3. **SQLite/SQLCipher**: Local database not yet integrated
4. **Sync engine**: Partial implementation
5. **API documentation**: Swagger/OpenAPI TODO
6. **Dependency injection**: Currently using direct instantiation

## Testing Strategy

- **Framework**: Jest + ts-jest
- **Test files**: Co-located with source (`.test.ts` or `.spec.ts`)
- **Coverage**: Run `npm test -- --coverage`
- **Watch mode**: `npm test -- --watch`

## Development Workflow

### Starting Development
```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend

# Access app at http://localhost:5173
# API at http://localhost:3000/api
```

### Making Schema Changes
```bash
# 1. Edit prisma/schema.prisma
# 2. Generate client
npx prisma generate
# 3. Push changes to database (development)
npx prisma db push
# OR create migration (production)
npm run prisma:migrate
# 4. Restart backend server
```

### Debugging Tips
- Backend logs: Winston logger outputs to console in development
- Frontend: React DevTools + Network tab
- Database: Use `npm run prisma:studio` for GUI
- Check health: `http://localhost:3000/health`

### Common Issues & Solutions

**1. "prepared statement already exists" Error**
- **Cause**: Multiple Prisma clients or node processes connecting simultaneously
- **Solution**: Kill all node processes: `taskkill //F //IM node.exe` (Windows) then restart servers

**2. Login Not Working / Authentication Failures**
- **Cause**: Database schema mismatch or missing user data
- **Solution**:
  ```bash
  # Check if tenant and user exist
  node list-tenants.js

  # If missing, recreate initial data
  node final-create-admin.js
  ```

**3. Prisma Client Generation Errors**
- **Cause**: Outdated client or schema changes not synced
- **Solution**:
  ```bash
  npx prisma generate
  # Restart backend server after generation
  ```

**4. Database Connection Timeouts During Migrations**
- **Cause**: Using pooler connection (port 6543) for migrations
- **Solution**: Ensure `DIRECT_URL` uses port 5432 (direct connection), not pooler

**5. Schema Push Hanging or Failing**
- **Cause**: Conflicting enum changes or corrupt schema state
- **Solution**:
  ```bash
  # Wipe database and start fresh
  node wipe-database.js
  npx prisma db push --accept-data-loss
  node final-create-admin.js
  ```

## Build & Deployment

### Backend Production Build
```bash
npm run build:backend
# Output: dist/backend/
# Run: node dist/backend/server.js
```

### Frontend Production Build
```bash
npm run build:frontend
# Output: dist/frontend/
# Serve static files with any web server
```

### Electron Desktop Build
```bash
npm run build:electron
# Output: dist-electron/
# Installers for Windows (NSIS), Mac (DMG), Linux (AppImage)
```

## Project Status

**Implemented Modules**:
- ✅ Authentication & User Management
- ✅ Patient Registration & Search
- ✅ Appointment Scheduling (with calendar UI)
- ✅ Consultations (SOAP notes, vital signs)
- ✅ E-Prescribing
- ✅ Lab Tests (ordering, processing, results)
- ✅ Billing & Invoicing
- ✅ Pharmacy (partial - backend routes disabled)

**In Progress/TODO**:
- ⏳ Offline sync engine
- ⏳ Electron desktop app
- ⏳ SQLite local database integration
- ⏳ Pharmacy module completion
- ⏳ Reporting & analytics
- ⏳ API documentation (Swagger)

## Important Files to Reference

- Architecture guide: `src/backend/ARCHITECTURE.md`
- Database schema: `prisma/schema.prisma`
- API server: `src/backend/server.ts`
- Frontend router: `src/frontend/App.tsx`
- Environment template: `.env.example`
- Setup guides: `README.md`, `SUPABASE_CHECKLIST.md`
