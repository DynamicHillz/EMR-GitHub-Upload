# SSMC EMR - Electronic Medical Records System

> Offline-first, cloud-synced Electronic Medical Records system for private clinics in emerging markets

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-PROPRIETARY-red)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green)

---

## 🎯 Project Overview

**SSMC EMR** is a comprehensive, offline-capable Electronic Medical Records system designed specifically for private clinics in emerging markets. The system operates seamlessly offline on desktop applications with automatic cloud synchronization, supporting complete clinical workflows from patient registration through billing.

### Key Features

- ✅ **Offline-First Architecture** - Works completely without internet
- ✅ **Cloud Synchronization** - Automatic bi-directional sync when online
- ✅ **Multi-Tenant SaaS** - Supports 100+ independent clinics
- ✅ **Complete Clinical Workflow** - Patient → Consultation → Lab → Pharmacy → Billing
- ✅ **GDPR/NDPR Compliant** - Built-in consent tracking and data protection
- ✅ **Role-Based Access Control** - 7 user roles with granular permissions
- ✅ **Desktop Applications** - Electron apps for Windows, macOS, Linux

---

## 🏗️ Architecture

### Technology Stack

#### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **React Query** for data fetching
- **Zustand** for state management

#### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Prisma ORM** for database abstraction
- **JWT** for authentication
- **Winston** for logging

#### Database
- **PostgreSQL** (cloud) - Single source of truth
- **SQLite** (local) - Offline operations with SQLCipher encryption

#### Desktop
- **Electron** - Cross-platform desktop application

#### DevOps
- **Prisma Migrations** for database versioning
- **ESLint & Prettier** for code quality
- **Jest** for testing

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Cloud Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Frontend   │  │   Backend    │  │  PostgreSQL  │ │
│  │   (Vercel)   │  │  (Render)    │  │   Database   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                          ▲ ▼
                   Sync API (HTTPS)
                          ▲ ▼
┌─────────────────────────────────────────────────────────┐
│              Clinic Laptops (Offline-First)             │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Electron Desktop App                   │  │
│  │  ┌────────────┐  ┌────────────┐  ┌───────────┐ │  │
│  │  │   React    │  │   Sync     │  │  SQLite   │ │  │
│  │  │  Frontend  │  │   Engine   │  │ (Encrypted)│ │  │
│  │  └────────────┘  └────────────┘  └───────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
St.stephen EMR/
├── doc/                          # Documentation
│   ├── project-idea.md
│   ├── Core_Requirements.md
│   └── Patient_SSMC_EMR_User_Stories.md
├── prisma/
│   └── schema.prisma            # Database schema (110 models)
├── src/
│   ├── backend/                 # Node.js API server
│   │   ├── server.ts           # Express server setup
│   │   ├── controllers/        # Route controllers
│   │   ├── middleware/         # Auth, error handling
│   │   ├── routes/             # API routes
│   │   └── utils/              # Utilities (logger, etc.)
│   ├── frontend/               # React application
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/         # Reusable components
│   │   └── pages/              # Page components
│   ├── electron/               # Electron main process (TODO)
│   └── shared/                 # Shared types & utilities
├── .env.example                # Environment variables template
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0 ✅ (Already installed!)
- **npm** >= 11.0.0 ✅ (Already installed!)
- **Supabase Account** (Free PostgreSQL database - recommended)
  - OR **PostgreSQL** 15+ (local installation)
- **Git** (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "St.stephen EMR"
   ```

2. **Install dependencies** ✅ (Already done!)
   ```bash
   npm install  # 879 packages installed
   ```

3. **Set up Supabase Database** (Recommended - Free & Easy!)

   **📘 Follow the step-by-step guide:** [SUPABASE_CHECKLIST.md](SUPABASE_CHECKLIST.md)

   Quick steps:
   - Create free account at https://supabase.com
   - Create new project
   - Copy connection string
   - Configure `.env` file
   - Run migrations

   **Total time:** ~15 minutes

   **Alternative:** [Local PostgreSQL setup](INSTALL_POSTGRESQL.md) (requires admin rights)

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase connection string
   ```

5. **Initialize database**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

### Development

Run the development servers:

```bash
# Terminal 1: Backend API server (http://localhost:3000)
npm run dev:backend

# Terminal 2: Frontend dev server (http://localhost:5173)
npm run dev:frontend

# Terminal 3: Electron desktop app (when ready)
npm run dev:electron
```

### Building for Production

```bash
# Build backend
npm run build:backend

# Build frontend
npm run build:frontend

# Build Electron desktop app
npm run build:electron
```

---

## 📋 Database Schema

The system includes comprehensive models covering:

### Core Entities
- **Tenants** - Multi-tenancy support
- **Users** - 7 role types (Admin, Doctor, Nurse, Lab Tech, Pharmacist, Cashier, Receptionist)
- **Patients** - Complete demographics and medical history
- **Appointments** - Scheduling with reminders
- **Consultations** - SOAP notes and vital signs
- **Prescriptions** - E-prescribing with allergy checking
- **Lab Tests** - Full lab workflow
- **Medications** - Inventory management
- **Invoices** - Billing and payments

### Sync & Compliance
- **SyncDevices** - Device registration and token management
- **SyncQueue** - Conflict detection and resolution
- **AuditLogs** - 7-year retention for compliance

**View the complete schema:** [prisma/schema.prisma](prisma/schema.prisma)

---

## 🔐 Security Features

- ✅ **JWT Authentication** with 8-hour expiration
- ✅ **bcrypt Password Hashing** (cost factor 12)
- ✅ **SQLCipher Encryption** for local databases
- ✅ **TLS 1.3** for data in transit
- ✅ **Rate Limiting** (100 req/min per IP)
- ✅ **Helmet.js** security headers
- ✅ **Role-Based Access Control** (RBAC)
- ✅ **SQL Injection Prevention** via Prisma ORM
- ✅ **XSS Protection** via input sanitization

---

## 🔄 Offline Sync Strategy

### How It Works

1. **Local-First Operations**
   - All CRUD operations hit local SQLite database first
   - Immediate response to user actions (no network latency)
   - Changes queued for synchronization

2. **Automatic Sync** (every 15 minutes when online)
   - Incremental sync (only changed records)
   - Priority-based queue (prescriptions > routine updates)
   - Checksum verification for data integrity

3. **Conflict Resolution**
   - Last-write-wins for simple fields
   - Operational transform for complex merges
   - Manual resolution UI for unresolvable conflicts

4. **Full Sync** (nightly at 2 AM)
   - Complete database reconciliation
   - Ensures eventual consistency

---

## 👥 User Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Admin** | Full system access, user management, tenant configuration |
| **Doctor** | Patient records, consultations, prescriptions, lab orders |
| **Nurse** | Vital signs, patient check-in, consultation support |
| **Lab Tech** | Lab test processing, results entry |
| **Pharmacist** | Medication dispensing, inventory management |
| **Cashier** | Billing, payment collection, invoice generation |
| **Receptionist** | Patient registration, appointment scheduling |

---

## 📊 MVP Development Plan

### Sprint Timeline (6 months)

**Sprint 1-2: Foundation** (4 weeks)
- User authentication & role management
- Desktop app installation
- Patient registration

**Sprint 3-4: Offline Core** (4 weeks)
- Offline operation implementation
- Initial data download
- Basic bi-directional sync

**Sprint 5-6: Clinical Workflows Part 1** (4 weeks)
- Consultation documentation (SOAP notes)
- E-prescribing
- Vital signs capture

**Sprint 7-8: Sync Intelligence** (4 weeks)
- Conflict detection & resolution
- Priority-based sync queue
- Manual sync triggers

**Sprint 9-10: Appointments & Lab** (4 weeks)
- Appointment scheduling
- Lab test ordering & processing
- Lab results entry & approval

**Sprint 11-12: Pharmacy & Billing** (4 weeks)
- Medication dispensing
- Inventory management
- Automatic bill generation

**Sprint 13: GDPR & Polish** (2 weeks)
- GDPR compliance features
- Reporting
- Bug fixes & documentation

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

---

## 📝 API Documentation

Once the server is running, API documentation is available at:
- **Swagger UI:** `http://localhost:3000/api-docs` (TODO)

### Example Endpoints

```
POST   /api/auth/login              # User login
GET    /api/patients                # List patients
POST   /api/patients                # Register patient
GET    /api/patients/search?q=John  # Search patients
POST   /api/consultations           # Create consultation
POST   /api/prescriptions           # Create prescription
GET    /api/lab/tests               # List lab tests
POST   /api/billing/invoices        # Generate invoice
POST   /api/sync/push               # Push local changes
GET    /api/sync/pull               # Pull remote changes
```

---

## 🔧 Configuration

### Environment Variables

See [.env.example](.env.example) for all available configuration options.

Key settings:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Authentication secret
- `SYNC_INTERVAL_MS` - Sync frequency (default: 900000 = 15 min)
- `RATE_LIMIT_MAX_REQUESTS` - API rate limit

---

## 🐛 Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check PostgreSQL is running
# Verify DATABASE_URL in .env
npm run prisma:migrate
```

**Port already in use**
```bash
# Change PORT in .env
# Or kill process on port 3000/5173
```

**Sync not working**
```bash
# Check internet connection
# Verify device token is valid
# Check sync_queue table for errors
```

---

## 📄 License

**PROPRIETARY** - This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.

---

## 👨‍💻 Development Team

- **Product Manager / Architect:** Hillz
- **Full-Stack Developer:** [Your Name]
- **Healthcare Consultant:** [TBD]

---

## 🤝 Contributing

This is a proprietary project. For internal team members:

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit pull request for review

---

## 📞 Support

For issues and questions:
- **Email:** support@medflowemr.com
- **Docs:** [Internal Wiki]
- **Slack:** #medflow-dev

---

**Built with ❤️ for healthcare providers in emerging markets**
