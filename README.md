# SSMC EMR — Electronic Medical Records System

> A multi-tenant Electronic Medical Records system built for private clinics in emerging markets — designed to run reliably on a single on-prem PC over unreliable local infrastructure, not just a cloud data center.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-PROPRIETARY-red)
![Tests](https://img.shields.io/badge/tests-474%20passing-brightgreen)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)

---

> **Note on history**: this repository is a published snapshot for portfolio review. Active development history lives in the clinic's private repository.

## About this project

Built for **St. Stephen Medical Centre**, a private clinic, to replace paper-based patient records with a full digital workflow — registration, consultations, lab, pharmacy, billing, and inpatient care — running on a single Windows PC at the clinic, with no dependency on cloud infrastructure or reliable internet.

This was built AI-assisted, directed end-to-end through Claude Code: every product decision, architectural tradeoff, feature scope, and deployment step below was specified, reviewed, and tested by hand — including catching and fixing real production bugs (a mixed-content HTTPS regression that broke login) and building an offline-deployment procedure for regions where a stable internet connection during setup isn't a safe assumption.

---

## What it actually does

- **Patient management** — registration, search, allergy/chronic-condition tracking, full demographic history
- **Appointments** — calendar scheduling, check-in, waiting queue
- **Consultations** — SOAP notes, vitals, ICD-11 diagnosis coding (via a local WHO ICD-11 terminology service)
- **E-prescribing** — with automated drug-interaction and allergy checking at dispense time
- **Pharmacy** — medication & consumable inventory, batch/expiry tracking, dispensing, stock alerts, oxygen-therapy administration tracking
- **Lab** — order → queue → result entry, with automatic critical-value flagging and delta-change alerts
- **Billing** — itemized invoicing, insurance & exemption-policy handling, refund workflow, fraud-prevention checks, and multi-gateway payments (Flutterwave, Moniepoint, Paystack) — including billing for blood transfusions, surgical procedures, and labour & delivery, each linked back to its clinical record so nothing is billed twice
- **Inpatient/ward management** — admissions, bed transfers, discharge summaries, vital/fluid/transfusion/blood-sugar charts, operation notes with a procedure-analytics dashboard
- **Triage, MCH** — antenatal care, immunization schedules, labour & delivery with partograph tracking
- **Interoperability** — FHIR patient export, DHIS2 aggregate reporting
- **Audit logging** — 7-year retention for regulatory compliance (NDPR)
- **Offline-first** — an IndexedDB write queue and encrypted read cache keep the app usable through connectivity drops, with a PWA service worker precaching the app shell

## Why this isn't "just another CRUD app"

The interesting engineering here isn't the feature list — it's what it takes to run real clinical software reliably in the actual conditions of a Nigerian clinic:

- **HTTPS on a LAN, not just localhost** — browsers only allow service workers to register under a secure context, so every workstation reaching the clinic server over the LAN needed real TLS, not a self-signed shortcut, via a locally-trusted CA (`mkcert`).
- **Automated, verified backups** — a scheduled `pg_dump` job with an actual restore drill into a scratch database, not just "a backup script exists."
- **Boot-time recovery** — the app survives a Windows reboot or power cycle unattended, since there's no IT staff on-site to restart it manually.
- **Offline deployment packaging** — when the internet is too unreliable to trust for `npm install` or `git clone`, the entire dependency tree and required installers can be packaged onto a USB drive instead.
- **474 automated tests** across 70 suites — unit coverage for every backend domain (pharmacy, lab, billing, user management, appointments, auth, interoperability) plus integration tests for the highest-risk flows (payments, refunds, drug interactions, lab results).

See [`CLINIC_DEPLOYMENT_CHECKLIST.md`](CLINIC_DEPLOYMENT_CHECKLIST.md) for the actual step-by-step procedure used to stand up a new clinic server from a bare Windows PC.

---

## Architecture

**Backend**: Clean Architecture — domain / application / infrastructure / presentation layers, with dependencies pointing inward. The four most business-logic-heavy domains (patient, appointment, consultation, user) have full domain entities and repository interfaces; the rest use direct Prisma injection into use-cases, which is the deliberate, consistent pattern for the remaining domains rather than a shortcut.

**Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, React Router, React Hook Form. Global state is plain React Context — no Redux/Zustand overhead for an app this size.

**Database**: PostgreSQL via Prisma ORM — 60 models / 40 enums, with a real tracked migration history (`prisma migrate`), not ad-hoc schema pushes.

**Process management**: PM2 in production, with Windows boot-recovery configured so the app comes back online automatically after a reboot with no manual intervention.

```
src/
├── backend/
│   ├── domain/            # Entities, repository interfaces, domain services
│   ├── application/       # Use cases, DTOs, validators
│   ├── infrastructure/    # Prisma repositories, payment gateways, external services
│   ├── presentation/      # Controllers, routes, middleware
│   └── shared/            # Cross-cutting utilities, error types
└── frontend/
    ├── components/        # Domain-organized UI components
    ├── pages/              # Route-level pages
    └── services/           # API client layer
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router v6, React Hook Form |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Auth | JWT (8h expiry), bcrypt (cost factor 12), role-based access control (8 roles) |
| Payments | Flutterwave, Moniepoint, Paystack |
| Process management | PM2 |
| Testing | Jest, ts-jest — 474 tests |
| Offline | Service Worker (Workbox), IndexedDB |

---

## Getting started (local development)

```bash
git clone <repository-url>
cd St.stephen_EMR
npm install

# Configure .env — see CLAUDE.md's Environment Configuration section
# for the current required variables (there's no committed .env.example;
# the running .env is the source of truth for what's in use)

npx prisma migrate deploy   # apply the tracked migration history
node scripts/final-create-admin.js   # creates initial tenant + admin login

npm run dev:backend    # http://localhost:3000
npm run dev:frontend   # http://localhost:5173
```

### Testing

```bash
npm test                 # full suite
npm test -- --coverage   # with coverage report
```

### Production deployment

Production runs under PM2 (`ecosystem.config.js`), not the dev scripts above. For standing up a **new** clinic server from scratch — TLS certificates, scheduled backups, boot-time recovery, and an offline-deployment path for unreliable connectivity — see [`CLINIC_DEPLOYMENT_CHECKLIST.md`](CLINIC_DEPLOYMENT_CHECKLIST.md).

---

## License

Proprietary. Built for a real clinic handling real patient data — not licensed for reuse. Shared here as a portfolio/case-study reference.
