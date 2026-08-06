# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SSMC EMR is an Electronic Medical Records system for private clinics in emerging markets, supporting complete clinical workflows from patient registration through billing. It runs as a web app (Vite frontend + Express backend against Supabase/PostgreSQL).

**⚠️ Electron desktop app is no longer supported (decided 2026-07-24).** Do not build new features against `src/electron/`, don't fix the broken Electron entry point (see old Known Issues), and don't route users toward `npm run dev:electron`/`build:electron`. The offline-first/local-SQLite/sync-engine framing below is legacy context explaining *why* certain backend pieces (SyncDevice, SyncQueue, the sync routes) exist — treat them as dead/deprioritized weight, not a direction to keep building in, unless the user explicitly revives that effort.

**Key Characteristics**:
- **Business model (corrected 2026-08-01): licensed on-premise software, not a cloud SaaS subscription.** Each clinic gets its own on-premise installation (implementation fee + license + annual maintenance fee), not a shared hosted instance — see `CLINIC_DEPLOYMENT_CHECKLIST.md`, which already walks through standing up one physical server per clinic. The multi-tenant DB schema (`tenantId` on every model) is *not* being removed for this — an on-premise install simply runs with a single tenant row. Don't propose cloud-multi-tenant-SaaS-shaped features (self-service signup, usage-based billing, a central dashboard managing many clinics from one place) unless explicitly asked.
- Offline-first with bi-directional cloud sync (real code exists; see Known Issues — parts are broken/inactive, not just "planned")
- PostgreSQL (cloud via Supabase) + SQLite (local, via `better-sqlite3`; SQLCipher encryption is likely non-functional — see Known Issues)
- 8 user roles (from `UserRole` enum in `prisma/schema.prisma`): SUPER_ADMIN, ADMIN, DOCTOR, NURSE, LAB_TECH, PHARMACIST, CASHIER, RECEPTIONIST. The frontend RBAC also references a `MANAGER` role in places that isn't in this enum — treat as a possible latent bug/future addition, not a real role, until reconciled.
- 60 Prisma models / 40 enums covering comprehensive healthcare workflows (verified count — do not use "110+", that figure is stale)

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

### Electron Desktop App — ⚠️ NO LONGER SUPPORTED (as of 2026-07-24)
```bash
npm run dev:electron         # Do not use — Electron is deprecated, and the entry point is broken anyway (see Known Issues)
npm run build:electron       # Do not use
```
The project ships as a web app only going forward (Vite frontend + Express backend). `src/electron/` and these scripts are legacy and should not be extended.

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

**Reality check (verified against code, not aspirational)**: These rules are only fully followed for `patient`, `appointment`, `consultation`, and `user` — those four have real domain entities, repository interfaces, and repository implementations (`domain/entities/`, `domain/interfaces/`, `infrastructure/database/repositories/` each have exactly 4 files, one per domain). **Billing, pharmacy, lab, auth, interoperability, and tenant use-cases have no domain entities/interfaces/repositories at all** — their use-cases take `PrismaClient` directly as a constructor dependency and controllers do `new SomeUseCase(prisma)` inline. There is no DI container anywhere in the codebase. When adding a feature in one of the un-refactored domains, match the existing direct-Prisma-injection pattern already used by sibling use-cases in that folder rather than introducing a new repository/DI pattern unilaterally — raise it with the user first if you think the domain deserves the full repository treatment.

**Use-case inventory** (`src/backend/application/use-cases/`, as of 2026-07-24):
- `auth/` — login, register, logout, refresh-token, forgot/reset-password
- `patient/` — register, get, update, delete, search (+ unit tests)
- `appointment/` — book, cancel, check-in, get-appointments, waiting-queue
- `consultation/` — create, update, finalize, get, get-patient-consultations, create-prescription, order-lab-test (+ unit tests)
- `billing/` — service catalog CRUD, invoicing, payments, outstanding/balance, full refund workflow (request/approve/reject/process/get-refund-requests), gateway payment initiate/verify
- `lab/` — dictionary CRUD, test queue, results submit/review, specimen/status updates
- `pharmacy/` — medications, batches, drug-interaction checks, dispensing, labels, stock alerts, inventory, prescription queue (fully built out, not partial)
- `interoperability/` — FHIR patient export (real, tested, read-only), DHIS2 aggregate sync (real push implementation as of 2026-08-01 — see Known Issues & Technical Debt item 7), config get/update, sync history
- `tenant/` — billing-config, branding get/update
- `user/` — create, update, get, list, change-password, deactivate/reactivate/suspend

Other backend additions not obvious from the folder names above: `application/services/fraud-prevention.service.ts` (checks `FraudPreventionSettings` per tenant, flags duplicate payments on the same invoice — invoked from the payment use-case, not wired as Express middleware), and a real multi-gateway payment integration under `infrastructure/payment-gateways/` (Flutterwave, Moniepoint, Paystack + a factory/shared interface).

### Frontend: React with Component-Based Structure

```
src/frontend/
├── App.tsx                  # Router and route definitions (~30 routes)
├── main.tsx                 # React app entry point
├── contexts/
│   └── AuthContext.tsx      # Actual global state: user, login/logout, hasRole(), 15-min inactivity auto-logout, getRoleHomePage()
├── services/                 # Hand-rolled API clients (auth, billing, audit, inpatient each create their own axios instance)
├── components/              # Reusable UI components
│   ├── layout/              # MainLayout.tsx — single nav array filtered by requiredRoles per item
│   ├── appointments/, consultations/, lab/, billing/, pharmacy/, inpatient/, mch/, triage/, patients/, common/
│   └── ...                  # Other domain-specific components
└── pages/                   # ~39 top-level + nested page files, incl. billing/ (7), users/ (3), lab/ (2), audit/
```

**Frontend Stack (as actually used — verified 2026-07-24, do not trust package.json alone)**:
- React 18 + TypeScript, React Router v6 (real, ~30 routes with role-based guards)
- React Hook Form, Tailwind CSS, Lucide React, React Big Calendar
- **Zustand is a dead dependency**: listed in `package.json` but not imported anywhere in `src/frontend`. Global state is actually done via React Context (`AuthContext.tsx`). Don't introduce a Zustand store expecting existing state to already use it, and don't assume `zustand` in package.json means state is centralized — it isn't.
- **React Query is wired up but unused**: `QueryClientProvider` is set up in `App.tsx` but no page uses `useQuery`/`useMutation`. Data fetching is actually done ad hoc per-page with `useState`/`useEffect` + either raw `fetch()` (e.g. `PatientsPage.tsx`) or one of several hand-rolled `axios.create()` service classes under `services/` — there is no single shared API client. When adding a new page's data fetching, match whichever pattern the sibling pages in that domain already use rather than introducing React Query as if it were the established pattern.
- One shared UI shell for all roles (`MainLayout`) with role-filtered navigation and redirect targets (`getRoleHomePage()`), not separate per-role dashboards/apps.

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

60 models / 40 enums total (verified via grep on `prisma/schema.prisma`, 2026-07-24). Rough domain grouping:
- **Multi-tenancy (1)**: `Tenant` — all models include `tenantId` for data isolation
- **Auth/user (4)**: User, PasswordResetToken, RefreshToken, Session
- **Patient/clinical (24)**: Patient, Appointment, Consultation, PatientAllergy, NextOfKin, Triage, DiagnosisCatalog, ConsultationDiagnosis, AncPregnancy, AncVisit, ImmunizationSchedule, PatientImmunization, Ward, Bed, Admission, WardRound, MedicationAdministration, VitalChart, FluidChart, TransfusionChart, BloodSugarChart, AdmissionDiagnosis, DischargeSummary, BedTransferHistory
- **Pharmacy/inventory (6)**: Medication, MedicationBatch, DispensingRecord, DrugInteraction, StockAlert, Prescription
- **Lab/imaging (9)**: LabTest, LabParameter, LabReferenceRange, LabTestParameter, LabOrder, LabTestRecord, LabResultValue, ImagingTest, ImagingResult
- **Billing/finance (12)**: Invoice, InvoiceLineItem, InvoiceAuditLog, InsuranceProvider, PatientInsurance, InsuranceClaim, ExemptionPolicy, Payment, Refund, PaymentAuditLog, FraudPreventionSettings, ServiceCatalog
- **Sync (2)**: SyncDevice, SyncQueue
- **Audit (1)**: AuditLog — 7-year retention for compliance (GDPR/NDPR)
- **Other (1)**: SystemConfig

**Core Clinical Workflow**:
```
Patient → Appointment → Consultation → Prescription/LabTest
                                    → Invoice → Payment/Refund
```

**Correction (2026-07-27)**: earlier versions of this file described `sync.controller.ts`'s `prisma.syncConflict` reference as a schema mismatch that throws at runtime. That's fixed — a real `SyncConflict` model exists in `schema.prisma`, the code has no `@ts-ignore` around it, and `SyncConflictsPage.tsx` is wired to the real shape. Don't repeat the old "throws at runtime" claim.

**Migrations**: `prisma/migrations/` contains only one loose file (`manual_pharmacy_migration.sql`), not a real timestamped migration history — the schema has evidently been managed via `prisma db push`/manual SQL rather than `prisma migrate dev`. Don't assume `npm run prisma:migrate` reflects the actual history of how this schema evolved.

### Important Schema Considerations

1. **Prisma Client Location**: Generated to default `node_modules/@prisma/client`
2. **Always run after schema changes**: `npx prisma generate`
3. **Database Connection Requirements** — **correction (2026-07-26): this project runs on local PostgreSQL on a Windows machine, not Supabase**, despite older comments/docs in this repo saying otherwise. `DATABASE_URL` and `DIRECT_URL` both point at `localhost:5434` today (see `.env`) — there is no separate pooler port (6543) vs. direct port (5432) distinction in play; that split only matters if this is ever migrated to Supabase or another managed pooler.
   - Both URLs must be properly configured in `.env` with URL-encoded passwords (`#` becomes `%23`)
   - **`DATABASE_URL` has an explicit `connection_limit=10&pool_timeout=20`** (set 2026-07-26). Without it, the shared `PrismaClient` singleton (`src/backend/infrastructure/database/prisma.client.ts`) falls back to Prisma's default pool-size formula (`num_physical_cpus × 2 + 1`), shared by every request plus audit-log writes — under concurrent load this becomes a hard connection-pool ceiling (queued queries, sharp P95 latency spikes) rather than a gradual slowdown. `10` leaves headroom under local Postgres's default `max_connections=100`, alongside the scheduler's own separate bounded-pool client (`scheduler-prisma.client.ts`, `connection_limit=2`, so background jobs can't compete with the main pool) and any manual `psql`/Prisma Studio sessions. If this ever moves to a managed provider (Supabase or otherwise), re-size this to that provider's actual pooler tier rather than assuming `10` still applies.
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

**⚠️ Correction (2026-07-24): `final-create-admin.js` and `final-setup.js` still exist and are actively maintained — they were just moved from repo root into `scripts/`, not deleted.** `scripts/README.md` confirms these two are the current "Active Scripts" for DB setup/admin creation:
```bash
node scripts/final-create-admin.js   # Creates initial tenant and admin user
node scripts/final-setup.js          # Complete database setup script
```
`wipe-database.js`, `check-tables.js`, `list-tenants.js`, and `verify-user.js`, however, genuinely no longer exist anywhere in the repo — `old-scripts/` (where superseded scripts like these used to live "if needed for reference") was removed entirely on 2026-07-30 as part of a portfolio cleanup pass; git history still has them if truly needed. Before instructing the user to run any DB utility script, check whether it's under `scripts/` (current/active) vs root (uncatalogued one-off) — don't assume root is still where the maintained ones live.

The root directory has also accumulated a large, mostly undocumented set of ad-hoc one-off scripts (`check-active.js`, `check-db.js`, `check-tenants.js`, `check-users.js`, `check_patient_id.js`, `delete_patient.js`, `add-soft-deletes.js`, `fix_admin.js`, `fix-returns.js`, `fix-syntax.js`, `fix-trailing-quotes.js`, `find-ruth.js`, `find_deleted_patients.js`, `hard_delete_patients.js`, `get-users.js`, `insert_test.js`/`insert_test2.js`, `list_patients.js`, `query.js`, `query-cbc.js`, `query-params.js`, `rename_deleted_phones.js`, `seed-wards.js`, `seed-wards-all.js`, `start-frontend.js` (used by PM2 — see Production Process Management below, do not delete), `start-system.js`, `truncate-lab.js`, `reset-admin.ts`, plus ~20 `test-*.js/.ts` one-offs), plus a separate, untracked `scratch/` directory (never committed, so it doesn't show up on GitHub) — `old-scripts/`, which used to hold older/superseded variants, was removed from the repo entirely on 2026-07-30. Treat any given script name as unverified until you `ls`/Glob for it — don't assume one referenced in a past conversation or in this file still exists, still lives at the same path, or is the canonical version.

## Production Process Management (PM2)

**⚠️ The running system is managed by PM2, not `npm run dev:*` — do not remove or replace this as the project progresses (confirmed by user 2026-07-24).**

- Config: `ecosystem.config.js` at repo root, defining two apps:
  - `ssmc-emr-backend` — runs `dist/backend/server.js` (the **compiled** output, so `npm run build:backend` must be run before restarting this app for code changes to take effect), port 3000, `autorestart: true`, `max_memory_restart: '1G'`.
  - `ssmc-emr-frontend` — runs `start-frontend.js` (a root-level script — do not delete it as part of any "root script sprawl" cleanup; PM2 depends on it).
- Typical PM2 commands: `pm2 start ecosystem.config.js`, `pm2 restart ssmc-emr-backend`, `pm2 logs ssmc-emr-backend`, `pm2 status`. There are no `npm run` wrappers for these in `package.json` — PM2 is invoked directly.
- Implication for changes: after editing backend code, `npm run build:backend` then `pm2 restart ssmc-emr-backend` (not `npm run dev:backend`, which runs a separate nodemon process against `src/backend/server.ts` and would conflict with the PM2-managed instance if both run at once). Killing "all node processes" (see the "prepared statement already exists" fix below) will also kill the PM2-managed apps — check `pm2 status` afterward and `pm2 restart` anything PM2 was responsible for, rather than just re-running the dev scripts.

### Boot-time recovery (added 2026-07-27)

`pm2 startup` fails natively on Windows ("Init system not found" — there's no init system for it to hook into). Without something filling that gap, a Windows reboot or power-cycle (Windows Update, power outage) left the clinic down until someone manually ran `pm2 resurrect` or `pm2 start ecosystem.config.js`.

Fixed via [`pm2-windows-startup`](https://www.npmjs.com/package/pm2-windows-startup) (`npm install -g pm2-windows-startup` then `pm2-startup install`), which adds an `HKCU\...\Run` registry entry that invisibly runs `pm2 resurrect` on user logon — then `pm2 save` persists the current app list (`ssmc-emr-backend` + `ssmc-emr-frontend`) to `dump.pm2` so `resurrect` knows what to bring back. **This only fires once the `WINDOWS11` Windows account actually logs in** — on this machine that's a non-issue since `AutoAdminLogon` is already enabled for that account (`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon`), so a reboot logs in and resurrects PM2 automatically with no one present. If this is ever redeployed to a machine without auto-login configured, boot recovery silently won't fire until someone logs in — set up auto-login there too, or this reverts to the old manual-recovery situation.

If PM2's managed app list ever changes (new app added/removed from `ecosystem.config.js`), re-run `pm2 save` so `dump.pm2` reflects it — `pm2-startup` reads that snapshot, not `ecosystem.config.js`, on resurrect.

## External Service Dependency: ICD-11 (Docker)

**⚠️ A local WHO ICD-11 API Docker container must be running for live diagnosis coding search to work — do not remove this dependency or the code that calls it (confirmed by user 2026-07-24).**

- The diagnosis search endpoint (`GET /api/clinical/diagnoses`, implemented in `src/backend/presentation/routes/clinical.routes.ts`) calls a **local** WHO ICD-11 API container directly at `http://127.0.0.1:80/icd/release/11/2026-01/mms/search?q=...` (explicitly IPv4, per an inline comment in the code) — this is the Dockerized ICD-11 API, not a call out to the public WHO service.
- Flow: query → local Docker ICD-11 API → strip HTML from titles → **upsert each result into the `DiagnosisCatalog` table** (tenant-scoped, `type: 'ICD-11'`) so the returned `id` is a real DB UUID usable as a foreign key elsewhere (consultations, admissions, discharge summaries all reference `DiagnosisCatalog`).
- **Fallback behavior**: if the Docker container is down or the WHO API call fails/errors, the route catches the error and falls back to searching the already-cached rows in the local `DiagnosisCatalog` table instead of failing the request. This means diagnosis search can silently degrade to stale/partial local data if the container isn't running — if a user reports "diagnosis search is missing new codes" or "ICD search seems limited," check whether the Docker container is actually up before assuming it's a code bug.
- There's also `src/backend/scripts/seed-icd-catalog.ts` for pre-seeding `DiagnosisCatalog` (presumably from a bulk ICD-11 export, for offline/first-run use independent of the live container).
- No `docker-compose.yml`/`Dockerfile` for this container exists in this repo as of 2026-07-24 — the container is run/managed outside this codebase. If asked to change how diagnosis search works, don't assume the container's existence, port, or release path (`/11/2026-01/mms/`) can be freely changed without confirming what's actually running.

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
RATE_LIMIT_MAX_REQUESTS=400

# Sync
SYNC_INTERVAL_MS=900000  # 15 minutes
```

**Correction (2026-07-30): `.env.example` now exists** — added as part of the portfolio-polish pass, since the README's Getting Started section referencing a template that didn't exist read as a gap in a healthcare repo. It's kept manually in sync with `.env`'s actual keys (no automated check for drift) — if you add a new env var to the running `.env`, add it to `.env.example` too in the same change.

### TLS / HTTPS (required for LAN deployments)

**Added 2026-07-27.** Workstations reach the server over the clinic LAN (`vite.config.ts` sets `server.host: true`, `server.ts` binds `0.0.0.0`), not `localhost` — and browsers only allow a service worker to register under a "secure context" (HTTPS, or literally `localhost`). Since `main.tsx` unconditionally calls `registerSW(...)` to precache the offline app shell, any workstation other than the server machine itself needs real HTTPS for the offline capability to actually work — this isn't optional hardening, it's a hard browser platform requirement. It also stops login credentials and JWTs crossing the LAN in plaintext.

Both `src/backend/server.ts` and `start-frontend.js` are TLS-optional: if `TLS_CERT_PATH`/`TLS_KEY_PATH` are both set, each serves HTTPS (`https.createServer` in `server.ts`; `serve-handler` over `https` in `start-frontend.js`, since the `serve` CLI v14 has no `--ssl-cert` flag); if unset, both fall back to plain HTTP exactly as before, so local dev via `npm run dev:backend`/`dev:frontend` needs no cert setup.

**One-time setup per clinic server machine** (there's no public CA option here — this is a private LAN IP/hostname, so Let's Encrypt-style validation doesn't apply). **Done on this machine 2026-07-27**:
1. Install [mkcert](https://github.com/FiloSottile/mkcert) (`choco install mkcert` on Windows), then run `mkcert -install` once — this creates and trusts a local root CA on that machine. Root CA lives at `mkcert -CAROOT` (this machine: `C:\Users\WINDOWS11\AppData\Local\mkcert`).
2. Generate a cert covering every address the server is reached by: `mkcert -cert-file certs/server.crt -key-file certs/server.key localhost 127.0.0.1 <clinic-server-LAN-IP> <clinic-server-hostname>` (this machine: `192.168.1.102` / `HILLZ`, valid until Oct 2028). `certs/` is gitignored (private key, machine-specific — same treatment as `backups/`).
3. Set `TLS_CERT_PATH=certs/server.crt` and `TLS_KEY_PATH=certs/server.key` in `.env`, then `pm2 restart ssmc-emr-backend ssmc-emr-frontend`.
4. **One-time per workstation**: copy mkcert's root CA (`mkcert -CAROOT` on the server machine, look for `rootCA.pem`) to each workstation and trust it in that machine's certificate store (or push via group policy if the clinic has one). Without this step, browsers on other workstations will show a cert warning instead of trusting it silently. Verified 2026-07-27: real HTTPS works cleanly against both `localhost` and the LAN hostname/IP.

**Known client-tool quirk (not a server issue)**: `curl` on Windows (via the schannel TLS backend) can intermittently fail to validate the cert's IP-address SAN entries even though they're present and correct (confirm with `openssl x509 -in certs/server.crt -noout -text | grep -A2 "Subject Alternative Name"`) — validating against the DNS hostname (e.g. `https://HILLZ:3000/health`) instead of the raw IP is reliable. This is a `curl`/schannel-specific limitation; real browsers (Chrome, Edge, Firefox) validate IP SANs correctly and aren't affected — don't mistake a failed `curl -k`-less request against a raw IP for a broken cert.

**Frontend gotcha hit immediately after enabling HTTPS (fixed 2026-07-27)**: every frontend service file and ~40 pages/components independently built their own API URL with a hardcoded `http://${window.location.hostname}:3000` fallback (122 occurrences across 60 files — there is no single shared API client, per the Frontend Stack notes above). The moment the page itself loads over `https://`, browsers block those as mixed active content, which silently breaks every API call including login — this is exactly what happened here and is the most likely cause if login (or anything else) mysteriously stops working right after HTTPS is turned on. Fixed by replacing the hardcoded scheme with `${window.location.protocol}//${window.location.hostname}:3000` everywhere (mechanical find/replace, same pattern in every file) so it follows whatever scheme the page was actually loaded with — plain HTTP deployments are unaffected. If a new file introduces another hardcoded `http://${window.location.hostname}` API call, it will reproduce this exact bug under HTTPS.

**Correction (2026-07-27, same day): the machine this was all done on (`HILLZ` / `192.168.1.102`) is a developer's PC, not the real clinic server.** Everything above proved the mechanism works, but the actual cert, PM2 boot-recovery registration, and backup scheduled task all need to be redone from scratch on whichever machine actually becomes the clinic server — mkcert certs are bound to a specific hostname/IP, so this exact cert file is not valid anywhere else. See `CLINIC_DEPLOYMENT_CHECKLIST.md` for the full ordered setup procedure for that real machine, ending with an actual reboot test (impossible to do meaningfully on a dev machine that isn't the real target).

### CORS

**Added 2026-07-27.** `server.ts`'s `cors()` middleware reads an optional `CORS_ORIGIN` env var — a comma-separated allowlist (e.g. `https://192.168.1.102:5173,https://HILLZ:5173`, since a clinic is reachable by both its LAN IP and hostname). Leave unset and it falls back to reflecting any origin (`origin: true`), which is what this dev machine and every environment before this change already ran with — so nothing changes here until `CORS_ORIGIN` is actually set. At real clinic deployment, set it to that server's actual LAN IP/hostname (both, comma-separated) rather than leaving it open to any origin.

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
   # Wipe any existing data (if needed) — wipe-database.js no longer exists; use prisma db push --accept-data-loss below, or write a fresh one
   # Push Prisma schema to create all tables
   npx prisma db push --accept-data-loss

   # Create initial tenant and admin user
   node scripts/final-create-admin.js
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

Verified against `src/backend/server.ts` (2026-07-24) — all mounted with `authMiddleware` + `auditRequest` except `/health` and `/api/auth`:
```
/health                          # Health check (no auth required)
/api/auth/*                      # Login/register (no auth required)
/api/branding/*
/api/billing/config/*
/api/dashboard/*
/api/patients/*                  # Patient management
/api/appointments/*              # Scheduling
/api/consultations/*             # SOAP notes, vital signs
/api/prescriptions/*             # E-prescribing
/api/lab/*, /api/lab-tests/*     # Lab orders, catalog, and results
/api/pharmacy/*                  # Medication dispensing — ACTIVE, fully wired (not disabled — see Known Issues)
/api/billing/*                   # Invoicing, payments, and full refund workflow
/api/sync/*                      # Sync operations (push, conflicts) — partially broken, see Known Issues
/api/users/*                     # User management
/api/inpatients/*, /api/triage/*, /api/audit/*, /api/clinical/*
/api/interoperability/*          # FHIR / DHIS2
/api/outpatient-vitals/*, /api/verification/*, /api/insurance/*, /api/exemptions/*
/api/anc/*, /api/immunization/*
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
- Sync routes: `src/backend/presentation/routes/sync.routes.ts` (POST `/push`, GET `/conflicts`, POST `/conflicts/:id/resolve`)

**Correction (2026-07-27) — both items below are stale, do not repeat them**:
1. The `SyncConflict` mismatch is fixed (see the correction note earlier in this file) — `sync.controller.ts` doesn't throw here anymore.
2. `application/services/sync.worker.ts` **no longer exists in the codebase at all** — not just "never called," the file itself is gone. Don't reference it or suggest wiring it up.

The real current offline-sync implementation is web-native, not the SQLite/Electron flow described above: an IndexedDB-backed write queue (`src/frontend/services/offlineQueue.ts`, encrypted at rest via `offlineCrypto.ts`) queues CREATE/UPDATE writes when a request fails offline, replayed against `POST /api/sync/push` (`offlineSync.ts`) once connectivity returns; a bounded, encrypted read cache (`offlineCache.ts`) covers today's appointments and the patient currently being viewed; `sync.controller.ts` applies replayed writes through each entity's real use-case/service with optimistic-concurrency (`version`) checks, routing genuine conflicts into the real `SyncConflict` table reviewable via `SyncConflictsPage.tsx`. This was driven by an explicit product direction (2026-07-26/27): the system should work fully offline with network sync as an optional background convenience, not the other way around — treat this as active, maintained functionality, not legacy weight to avoid touching.

On the Electron/local side: `src/electron/services/SyncEngine.ts` and `OfflineDataService.ts` exist alongside `LocalDatabase.ts` (uses `better-sqlite3` directly). `LocalDatabase.ts` calls `db.pragma("key = '...'")` expecting SQLCipher-style encryption, but the project depends on vanilla `better-sqlite3` (not the also-installed `@journeyapps/sqlcipher` binding) — that pragma call is unlikely to actually encrypt anything. **This entire code path is moot now that Electron is no longer supported (2026-07-24)** — don't fix or extend it; if the user wants sync/offline capability going forward it needs to be redesigned for the web app, not patched here.

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

Re-audited 2026-07-24 — several items below have changed status since this file was first written; verify against code again before relying on old claims here in future sessions.

1. **Electron desktop app is deprecated — do not support or extend it (decided 2026-07-24)**. `src/electron/`, `npm run dev:electron`/`build:electron`, `LocalDatabase.ts`, `SyncEngine.ts`, `OfflineDataService.ts`, `NetworkMonitor.ts`, and the broken `package.json` `"main"` entry (points to `electron-main-simple.js`, which no longer exists anywhere in the repo — it was in `old-scripts/`, removed 2026-07-30) are all legacy. Don't fix the missing entry point, don't debug Electron packaging, and don't build new features assuming a desktop/offline client exists. The product is web-only (Vite + Express) going forward.
2. ~~**Prisma migration history is not real**~~ — **fixed 2026-07-27**: the database is now baselined into real Prisma migration history; see "Prisma Migration History" and the updated "Making Schema Changes" section above. Do not repeat the old claim that schema changes go through `db push`/manual SQL only — `prisma migrate dev` is now the standard procedure.
3. **API documentation**: Swagger/OpenAPI still TODO.
4. **Dependency injection**: Still direct instantiation everywhere (`new SomeUseCase(prisma)` in controllers) — no DI container. This is consistent, not itself a bug, but means the "Critical Architecture Rules" above only fully apply to the patient/appointment/consultation/user domains (see Backend Architecture section).
5. ~~**Test coverage is narrow**~~ — **effectively closed 2026-07-27**: every backend domain now has co-located unit tests — `patient/`, `consultation/`, `appointment/` (`book`/`cancel`/`check-in`; `get-appointments`/`get-waiting-queue` are thin reads, left uncovered), `auth/` (`logout`/`refresh-token`/`forgot-password`; `login`/`reset-password` have integration coverage instead — see below), and, added in one pass on 2026-07-27, full coverage of every use-case in `pharmacy/` (19 files, 116 tests), `lab/` (9 files, 81 tests), `user/` (8 files, 45 tests), `interoperability/` (2 files) and `tenant/` (9 files) (65 tests combined) — 474 total tests across 70 suites, up from 167. Billing use-cases remain the one domain without co-located unit tests, though they have the heaviest integration coverage of anything in the codebase (payment-processing, record-payment, refund-processing, gateway-payment, generate-invoice — see the integration list below). There are 11 integration test files (`src/backend/__tests__/integration/`, verified 2026-07-27): patient-registration, login, reset-password, payment-processing, record-payment, refund-processing, gateway-payment, generate-invoice, dispense-medication, check-drug-interactions, submit-lab-results.
6. ~~**Root directory script sprawl**~~ — **partially addressed 2026-07-30**: `old-scripts/`, `doc/`, `docs/`, and `sql/` (110 files of superseded scripts and stale planning/status docs) were removed from the repo for portfolio cleanliness. The dozens of undocumented one-off `.js`/`.ts` scripts at repo root and the untracked `scratch/` directory are unaffected by this — they were never committed in the first place (see Utility Scripts section), so they don't appear on GitHub but still clutter the local working directory.
7. ~~**DHIS2 aggregate sync is a payload-generation mock**~~ — **fixed 2026-08-01**: DHIS2 push is now a real implementation, not a mock. `Dhis2Client` (`infrastructure/external/dhis2.client.ts`) makes a genuine `POST {baseUrl}/api/dataValueSets` with Basic Auth, and classifies every outcome (`SUCCESS`/`WARNING` from DHIS2, or `REJECTED`/`AUTH_ERROR`/`NETWORK_ERROR` for a failed attempt) rather than assuming success. Config is fully per-tenant (`Tenant.dhis2Enabled/dhis2BaseUrl/dhis2Username/dhis2Password/dhis2OrgUnitId` + one data-element-UID field per metric + a shared `dhis2CategoryOptionCombo`), editable in Settings via `GET`/`PUT /api/interoperability/dhis2/config` — `orgUnit` is a real configured DHIS2 UID now, not `tenantId` reused, and data elements are real UIDs, not placeholder strings. `dhis2Password` is encrypted at rest (`infrastructure/security/encryption.util.ts`, AES-256-GCM, key from `ENCRYPTION_KEY` env var) and never returned by the GET endpoint — deliberately not copying the payment-gateway-secret pattern, which stores those plaintext and returns them raw. Every sync attempt (including ones that never reach DHIS2, e.g. missing config) is persisted to a new `Dhis2SyncLog` model and viewable via `GET /api/interoperability/dhis2/history` and a Sync History table on `InteroperabilityPage.tsx`. The `severeMalnutrition` metric bug is also fixed: it now queries `Triage.muac` (the real field) instead of the nonexistent `Consultation.muac`. **Still v1-scoped, not gaps**: no scheduled/automatic sync — manual trigger only (`scheduler.service.ts` has no DHIS2 job); no live DHIS2 instance has been tested against yet (only DHIS2's public demo server or a real facility instance would prove this end-to-end) — don't claim a specific clinic's DHIS2 submission has been verified until that's actually been done.

**No longer true — do not repeat these claims**: "Pharmacy routes temporarily disabled" (pharmacy is fully mounted and wired at `/api/pharmacy` with a complete 12-use-case module). Don't describe Electron as "not yet implemented" or "in progress" — it was implemented, then explicitly deprecated (2026-07-24); it's not a future task. Don't describe sync-conflict handling as broken or the sync worker as dead-but-present — see the corrections in the Offline Sync Strategy section above: `SyncConflict` is a real, working model, `sync.worker.ts` no longer exists in the repo at all, and the web-native offline-sync stack (`offlineQueue.ts`/`offlineCache.ts`/`offlineSync.ts`/`sync.controller.ts`) is active, maintained functionality per an explicit "work 100% offline" product direction — not legacy weight left over from the deprecated Electron story.

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

**Updated 2026-07-27**: the database is now baselined into real Prisma migration history (see "Prisma Migration History" below) — `prisma db push` is superseded as the standard procedure and should no longer be used for schema changes that need to reach the production database, since it has no rollback story. Use `npm run prisma:migrate` (`prisma migrate dev`) instead:
```bash
# 1. Edit prisma/schema.prisma
# 2. Create + apply a real migration (generates prisma/migrations/<timestamp>_<name>/migration.sql,
#    applies it, and runs `prisma generate` automatically)
npm run prisma:migrate -- --name <describe-the-change>
# 3. Restart backend server (pm2 restart ssmc-emr-backend, or npm run dev:backend locally)
```
`prisma db push` still has a legitimate niche — rapid schema iteration on a local scratch/throwaway database where you don't want migration files yet — but treat it as exploratory-only, never as how a schema change reaches the real database.

### Prisma Migration History

**Added 2026-07-27.** Previously the schema had no real migration history — every past change went through `prisma db push` or manual SQL (see the old note under Known Issues, now superseded). The database was baselined using Prisma's documented procedure for adopting migrations on an existing DB:
```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_baseline/migration.sql
npx prisma migrate resolve --applied <timestamp>_baseline
```
This produced `prisma/migrations/20260727113328_baseline/migration.sql` (419 DDL statements), marked as applied without re-running it (the live DB already matched). Verified by restoring that exact SQL into an empty scratch database with zero errors — `npx prisma migrate status` now reports "Database schema is up to date!" against the real database. From here forward, every schema change should go through `prisma migrate dev` (see above) so it gets its own timestamped migration file — don't hand-edit or delete anything under `prisma/migrations/`.

The pre-existing loose `prisma/migrations/manual_pharmacy_migration.sql` is left untouched — it sits outside any timestamped subfolder, so Prisma's migration system doesn't track it either way; it's a historical artifact, not part of the new tracked history.

### Debugging Tips
- Backend logs: Winston logger outputs to console in development
- Frontend: React DevTools + Network tab
- Database: Use `npm run prisma:studio` for GUI
- Check health: `http://localhost:3000/health`

### Common Issues & Solutions

**1. "prepared statement already exists" Error**
- **Cause**: Multiple Prisma clients or node processes connecting simultaneously
- **Solution**: Kill all node processes: `taskkill //F //IM node.exe` (Windows) then restart servers. **Note**: if the system is running under PM2 (see Production Process Management above), this also kills the PM2-managed backend/frontend apps — run `pm2 status` afterward and `pm2 restart ssmc-emr-backend`/`ssmc-emr-frontend` as needed rather than assuming PM2 will auto-recover them.

**2. Login Not Working / Authentication Failures**
- **Cause**: Database schema mismatch or missing user data
- **Solution**: `list-tenants.js` no longer exists anywhere in the repo (`old-scripts/`, where it lived, was removed 2026-07-30) — check tenant/user existence via `prisma:studio` instead. To recreate initial data: `node scripts/final-create-admin.js` (see Utility Scripts note above — this one lives in `scripts/`, it wasn't affected by the cleanup).

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
- **Solution**: `wipe-database.js` no longer exists — wipe/recreate manually via `prisma db push --accept-data-loss` plus `node scripts/final-create-admin.js` (this one is current, under `scripts/` — see Utility Scripts note above).

## Database Backups

**Added 2026-07-26.** Since this deployment is self-managed local PostgreSQL (not a provider with built-in point-in-time recovery), there was previously no backup mechanism at all. `scripts/backup-database.js` closes that gap:

- Runs `pg_dump` (custom compressed format, `-F c`) against `DIRECT_URL` (a one-shot dump shouldn't compete with the app's pooled `connection_limit`, and `pg_dump` needs a direct connection anyway).
- Writes timestamped files to `backups/` (gitignored — contains patient data) as `ssmc_emr_<ISO-timestamp>.dump`.
- Prunes any file older than 14 days on every run (edit `RETENTION_DAYS` in the script to change this — also prunes any orphaned `.dump.enc` staging file from a failed off-site upload, see below).
- Requires the PostgreSQL `bin/` directory (e.g. `C:\Program Files\PostgreSQL\16\bin`) on `PATH` so `pg_dump`/`pg_restore` resolve without a hardcoded path.

**Off-site copy — Backblaze B2 and/or Google Drive, added 2026-08-05, Google Drive added 2026-08-06.** Local-only backups share a single point of failure with the live database (disk failure, theft, fire). After the local dump succeeds, the script encrypts it once (AES-256-GCM via Node's built-in `crypto`, key derived from a passphrase — see `scripts/lib/backup-crypto.js`) and then attempts **whichever off-site provider(s) are actually configured in `.env` — B2, Google Drive, both, or neither** — via `rclone`, verifying each upload by checking the remote object's size matches before cleaning up the local encrypted staging file. Patient data is never uploaded in plaintext to either provider. This isn't a "pick one" choice baked into the code — a clinic can run either, both (for extra redundancy), or upgrade from one to the other later just by adding/removing env vars.

This step is **additive, not a hard dependency** — if no provider is configured, it's skipped with a clear warning and the local backup completes exactly as before. A local backup succeeding does NOT imply the off-site copy succeeded — check the log for `OFF-SITE BACKUP FAILED (<provider>)` separately from the main `Backup complete` line; each provider fails independently, so one being misconfigured doesn't block the other.

**Option A — Backblaze B2** (static API key, simpler one-time setup):
1. Install [rclone](https://rclone.org/downloads/) and put it on `PATH` (same treatment as the PostgreSQL `bin/` requirement above) — required for either provider.
2. Create a Backblaze account and a bucket (e.g. `ssmc-emr-backups`), then an Application Key scoped to just that bucket (Backblaze console → App Keys → Add a New Application Key).
3. On the bucket, add a **Lifecycle Rule** to delete files older than 90 days — off-site retention is intentionally longer than the 14-day local window (storage is a few cents/month at this volume either way). This is a one-time bucket setting, not something the script manages.
4. Set in `.env`: `B2_BUCKET`, `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`.

**Option B — Google Drive** (a clinic may already have this account; OAuth2 setup, a few extra manual steps):

*Corrected 2026-08-05, verified against a real setup*: an earlier version of this section said rclone's own built-in shared OAuth client was "fine... only worth revisiting if rate-limiting is ever actually hit." That was wrong — setting this up for real, `rclone` printed an explicit warning that the shared client_id **is being retired and will stop working during 2026**. A dedicated OAuth client is the real requirement, not an optional upgrade. Steps below reflect that.

1. Install rclone (as above) if not already done.
2. **Create a dedicated OAuth client** (Google Cloud Console, https://console.cloud.google.com/):
   - Create a project (any name, e.g. "SSMC EMR Backups").
   - APIs & Services → Library → enable the **Google Drive API**.
   - APIs & Services → OAuth consent screen → User type **External** (or **Internal** for a Google Workspace account) → fill in the required fields → leave publishing status as **Testing** (no need to submit for Google's verification) → under **Test users**, add the Google account that will own the backups — apps in Testing mode reject sign-in from any email not explicitly listed here, and this is the step most likely to get missed (it did, the first time, here).
   - APIs & Services → Credentials → Create Credentials → OAuth client ID → Application type **Desktop app** → Create. Copy the **Client ID** and **Client Secret** it shows.
3. Set `GDRIVE_CLIENT_ID` and `GDRIVE_CLIENT_SECRET` in `.env` to those two values.
4. Run `rclone authorize "drive" "<client id>" "<client secret>"` **on the clinic server**, following the browser prompt to sign into the Google account added as a test user above. It prints a JSON blob to the terminal — this is a real login token; it cannot be generated by a script, and it's tied to the client used to request it (re-running a bare `rclone authorize "drive"` later would silently go back to the shared client).
5. Set `GDRIVE_RCLONE_TOKEN` in `.env` to that exact JSON blob (single line, keep the quotes).
6. Optional: create a "SSMC EMR Backups" folder in Drive, open it, copy the folder ID out of the URL, and set `GDRIVE_FOLDER_ID` — otherwise backups land in Drive root.
7. Unlike B2, plain Google Drive has no server-side "delete after N days" setting — the script prunes Drive backups older than 90 days itself, after each successful upload (`rclone delete --min-age 90d`), rather than relying on a platform feature that doesn't exist here.

**Either way**, also set `BACKUP_ENCRYPTION_PASSPHRASE` in `.env` (a long random passphrase — losing this makes every off-site backup permanently undecryptable, same risk profile as the license private key), then run `node scripts/backup-database.js` manually once and confirm the log shows `Off-site backup verified (<provider>): ...` before trusting the nightly schedule with it.

**Manual run:**
```bash
node scripts/backup-database.js
```

**Scheduled daily run — live as of 2026-07-27.** A Windows Scheduled Task named `SSMC EMR Database Backup` is registered (via `Register-ScheduledTask`, not the classic `schtasks /create` — its `/tr` flag can't express a working directory, and this script's `require('dotenv').config()` needs one, since it resolves `.env` relative to `process.cwd()`, not `__dirname` the way `backups/` is): runs `node scripts\backup-database.js` daily at 02:00, working directory set to the project root, principal `WINDOWS11` with highest privileges. Verified end-to-end 2026-07-27: manually triggered via `Start-ScheduledTask -TaskName "SSMC EMR Database Backup"`, produced a fresh file in `backups/`, and a full restore drill into a scratch DB succeeded (see Restore procedure below).

To recreate this task from scratch on a new machine (e.g. after a clinic redeploy), don't use the Task Scheduler GUI's "Basic Task" wizard — it can't set a working directory either. Use PowerShell:
```powershell
$action = New-ScheduledTaskAction -Execute "C:\Program Files\nodejs\node.exe" -Argument "scripts\backup-database.js" -WorkingDirectory "<full path to project root>"
$trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$principal = New-ScheduledTaskPrincipal -UserId "<windows username>" -LogonType Interactive -RunLevel Highest
Register-ScheduledTask -TaskName "SSMC EMR Database Backup" -Action $action -Trigger $trigger -Principal $principal -Description "Daily pg_dump backup of the SSMC EMR PostgreSQL database"
```
Check on it periodically with `Get-ScheduledTask -TaskName "SSMC EMR Database Backup" | Get-ScheduledTaskInfo` — `LastTaskResult: 0` means the previous run succeeded; anything else means the last scheduled run silently failed (most likely cause: PostgreSQL `bin/` fell off `PATH`, or a Windows update reset the task).

**Restore procedure:**
```bash
# If restoring from an off-site copy rather than a local backups/ file,
# download and decrypt it first — from B2:
rclone copy ssmcb2:<bucket>/ssmc_emr_<timestamp>.dump.enc .
# ...or from Google Drive:
rclone copy ssmcgdrive:ssmc_emr_<timestamp>.dump.enc .

node scripts/decrypt-backup.js ssmc_emr_<timestamp>.dump.enc ssmc_emr_<timestamp>.dump
# (needs BACKUP_ENCRYPTION_PASSPHRASE in .env and the same RCLONE_CONFIG_*
# env vars backup-database.js uses for whichever provider you're restoring
# from — see backupToB2()/backupToGoogleDrive() in that script.)

# List contents of a backup without restoring anything (sanity check):
pg_restore --list backups/ssmc_emr_<timestamp>.dump

# Restore into a NEW/empty scratch database first — never restore directly
# over the live database without a reason to believe it's actually needed:
createdb -h localhost -p 5434 -U postgres ssmc_emr_restore_test
pg_restore -h localhost -p 5434 -U postgres -d ssmc_emr_restore_test backups/ssmc_emr_<timestamp>.dump

# Only once verified, restoring over the real database (this drops/recreates
# conflicting objects via -c — downtime is expected, coordinate before running):
pg_restore -h localhost -p 5434 -U postgres -d ssmc_emr -c backups/ssmc_emr_<timestamp>.dump
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

### Electron Desktop Build — ⚠️ DEPRECATED, do not build or ship this (2026-07-24)
```bash
npm run build:electron    # Do not run — Electron is no longer a supported target, and the entry point is broken anyway
```

## Project Status

Re-verified against code 2026-07-24 (previous version of this section was significantly stale on pharmacy/electron status).

**Implemented Modules** (backend routes mounted + frontend pages/routes present):
- ✅ Authentication & User Management (incl. force-password-change flow, role-based access, suspend/deactivate)
- ✅ Patient Registration & Search
- ✅ Appointment Scheduling (calendar UI)
- ✅ Consultations (SOAP notes, vitals, diagnosis catalog)
- ✅ E-Prescribing
- ✅ Lab Tests (dictionary, ordering, queue, results, printable reports) + Imaging models
- ✅ Billing & Invoicing, incl. multi-gateway payments (Flutterwave/Moniepoint/Paystack), insurance/exemptions, and a full refund request→approve→process workflow
- ✅ Pharmacy — fully wired (medications, batches, drug-interaction checks, dispensing, stock alerts, inventory), not partial
- ✅ Inpatient/Ward management (admissions, bed transfers, discharge summaries, vital/fluid/transfusion/blood-sugar charts)
- ✅ Triage, ANC/immunization (MCH), audit log viewer, tenant branding/billing-config
- ✅ Maternity/newborn continuity (added 2026-08-06, closing gaps found in an obstetrician-positioning audit): on a live birth, `record-delivery-outcome.use-case.ts` optionally registers the newborn as their own `Patient` (synthetic placeholder phone/name — `Patient.phone` is required+unique and a newborn has none — plus a `motherPatientId` self-relation and a `NextOfKin` row pointing at the mother), which the existing "Immunizations Due" worklist now picks up same-day via a computed-on-read diff against `ImmunizationSchedule` (no placeholder `PatientImmunization` rows — that model requires `administeredById`/`administeredAt`, i.e. it represents a dose actually given). A new `PostnatalVisit` model + `/api/postnatal` (labor-style use-cases, not ANC's raw-controller pattern) covers the WHO/Nigeria 4-contact PNC schedule (24h/day3/week1/week6), with its own computed-on-read "Postnatal Care Due" worklist. Danger-sign staff notifications (`NotificationService.notifyRole(['DOCTOR','NURSE'])`, same pattern `record-partograph-observation.use-case.ts` already used) now also fire from delivery outcomes (possible PPH/stillbirth/low APGAR/resuscitation) and ANC visits (BP/proteinuria/FHR) — previously only the partograph fired one; the on-screen banners in those forms were informational-only and reached nobody not looking at that screen. `DischargeSummary` gained nullable maternity fields (breastfeeding/family-planning/newborn-danger-sign counseling, postnatal follow-up date, maternal/newborn condition), shown in `DischargeModal`/`DischargeSummaryPrintPage` only when the admission has a linked `LaborRecord`. **Scoped to singleton births** — `LaborRecord`'s baby fields are single-valued; twin/multiple-gestation delivery outcomes would need a one-row-per-baby redesign, not done here.
- ✅ Interoperability — FHIR patient export (real, tested, read-only) and DHIS2 aggregate sync (real push, per-tenant config, encrypted credentials, sync history — fixed 2026-08-01, see Known Issues & Technical Debt item 7). DHIS2 is manual-trigger-only for now (no scheduled auto-sync) and hasn't been proven against a live DHIS2 instance yet.
- ✅ Fraud prevention checks on payments
- ✅ Web-native offline-first sync (2026-07-27 correction — previously miscategorized as deprecated below): IndexedDB write queue + encrypted read cache on the frontend, `SyncDevice`/`SyncQueue`/`SyncConflict` + optimistic-concurrency on the backend. Actively maintained per an explicit "work 100% offline, network optional" product direction — not legacy weight.

**Deprecated — not a target for future work**:
- ❌ Electron desktop app — explicitly dropped 2026-07-24. Real code exists under `src/electron/` but it's unsupported; do not fix, extend, or route users toward it.
- ❌ Local SQLite (`better-sqlite3`)/SQLCipher (`src/electron/services/LocalDatabase.ts`) — Electron-only, moot now that Electron itself is dropped. Do not confuse this with the (active, web-native) offline sync engine above — they are unrelated despite similar naming.

**In Progress / TODO**:
- ⏳ Reporting & analytics
- ⏳ API documentation (Swagger)
- ⏳ Test coverage — thin outside patient/consultation unit tests and the 11 integration tests (see Known Issues & Technical Debt above for the current list)
- ⏳ DHIS2 aggregate sync — currently a mock with no real HTTP push (see Known Issues & Technical Debt item 7); a real implementation needs DHIS2 credentials/config, real data-element/org-unit UID mapping, error handling for rejected/partial submissions, and a fix for the broken `severeMalnutrition` metric before it can be called working.

## Important Files to Reference

- Architecture guide: `src/backend/ARCHITECTURE.md`
- Database schema: `prisma/schema.prisma`
- API server: `src/backend/server.ts`
- Frontend router: `src/frontend/App.tsx`
- Environment template: `.env.example`
- Setup guide: `README.md` (rewritten 2026-07-30 to reflect actual current state — the old version described a fictional Electron/Supabase/Zustand stack that never matched reality; `docs/`, `doc/`, and `sql/` — all stale planning/status docs and superseded manual-SQL setup scripts — were removed from the repo in the same pass, for portfolio cleanliness. `SUPABASE_CHECKLIST.md`/`INSTALL_POSTGRESQL.md` no longer exist; if you need the old Supabase-era history, it's in git history, not the working tree.)
- **New clinic server setup**: `CLINIC_DEPLOYMENT_CHECKLIST.md` (added 2026-07-27) — the ordered, copy-pasteable checklist for standing up a brand-new physical machine as the real server (TLS certs, PM2 boot recovery, backups, workstation trust distribution, reboot test). Everything up to this point in the engagement was proven on a developer's PC, not the real target — use this doc, not ad-hoc memory of those steps, when the real machine is actually set up.
- **Production incident response**: `INCIDENT_RUNBOOK.md` (added 2026-07-31) — the five most likely live-clinic failure modes (app down, login/network errors, reboot didn't recover, database down, data loss), each with tested diagnosis/fix steps. Two corrections already baked in from live testing, not just written from assumption: (1) PM2's `autorestart` self-heals a hard crash in seconds with zero manual action — a manual `pm2 restart` is only needed for a hang (process alive but unresponsive), not a crash; (2) once a stopped PostgreSQL service is restarted, the app reconnects on its own — no app restart needed. Also covers the update/rollback procedure for pushing changes to a live clinic. `SUPPORT_TERMS.md` (same date) is the companion business-terms draft — response times, support scope, and what the clinic is responsible for in return — explicitly flagged as needing real legal review before use, not a finished contract.
- **Licensing** (added 2026-08-01): `LICENSING.md` — vendor-facing (not clinic-facing) doc covering the one-time RSA keypair setup, how to issue/renew a clinic's license via `scripts/generate-license.ts`, and what to do if the private key is ever lost. A license is an RS256-signed JWT stored in `Tenant.licenseToken`, verified against the committed `config/license-public-key.pem` (the private half is gitignored, never committed — see `.gitignore`). Enforcement is deliberately soft everywhere: a missing/invalid/lapsed license only ever shows a banner to SUPER_ADMIN/ADMIN (`MainLayout.tsx`, driven by `GET /api/license/status`) — no clinical or billing feature is ever blocked for a licensing reason. Renewal/status editing lives at Settings > License, SUPER_ADMIN-only for writes.
