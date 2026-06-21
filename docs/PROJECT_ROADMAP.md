# Product Requirements Document (PRD)
## SSMC EMR – Offline-First Electronic Medical Records System

**Product Name:** SSMC EMR  
**Document Type:** Product Requirements Document (PRD)  
**Last Updated:** November 22, 2025  
**Product Status:** Active Development  
**Target Release:** Q2 2026  
**Primary Deployment Context:** Private clinics in emerging markets  

---

## 1. Product Vision

SSMC EMR is an **offline-first, desktop-based Electronic Medical Records (EMR) system** designed for private clinics operating in environments with **unreliable internet connectivity**.

The system must:
- Operate fully offline on clinic desktops
- Synchronize securely when connectivity is available
- Enforce strict patient data privacy
- Support complete clinical workflows end-to-end
- Scale as a multi-tenant SaaS serving 100+ clinics

---

## 2. Target Users & Roles

### Primary Users
- Doctors
- Nurses
- Front Desk / Reception
- Pharmacists
- Lab Technicians
- Accountants
- Clinic Administrators

### Roles (RBAC – Mandatory)
1. Super Admin (SaaS owner)
2. Clinic Admin
3. Doctor
4. Nurse
5. Lab Staff
6. Pharmacy Staff
7. Billing / Finance Staff

Each role must have **explicit permissions**.

---

## 3. Core Product Principles

1. **Offline-first by default**  
   The system must function without internet connectivity.

2. **Patient safety over convenience**  
   Allergy checking, audit logging, and data integrity are mandatory.

3. **Data isolation is non-negotiable**  
   Clinics must never see each other’s data.

4. **Explicit over implicit behavior**  
   No silent overwrites, merges, or sync decisions.

5. **Security before scale**  
   Authentication and authorization precede expansion features.

---

## 4. Functional Scope Overview

### Implemented Modules
- Billing (100% complete)

### In-Progress Modules
- Patient Management
- Appointments
- Consultations
- Lab Management
- Pharmacy (disabled)

### Planned Modules
- User Management & Authentication
- Sync Engine
- Electron Desktop App
- Reporting & Analytics

---

## 5. Module Requirements

### 5.1 Billing Module

**Status:** Complete  
**Priority:** HIGH  

#### Features
- Service catalog management
- Multi-line invoice generation
- Payment processing (manual + gateway)
- Outstanding balance tracking
- Refund handling
- Billing analytics dashboard

#### Constraints
- Invoices are immutable once finalized
- All billing actions must be auditable

---

### 5.2 Patient Management

**Status:** Partial  
**Priority:** HIGH  

#### Features
- Patient registration and updates
- Patient search and filtering
- Demographics management
- Medical history tracking
- Consent management (GDPR/NDPR)
- Patient data export

#### Constraints
- Medical history must be append-only
- Consent changes must be timestamped and auditable

---

### 5.3 Appointment Scheduling

**Status:** Partial  
**Priority:** HIGH  

#### Features
- Appointment booking and cancellation
- Patient check-in
- Waiting queue
- Conflict detection
- Recurring appointments
- SMS and email reminders

#### Constraints
- Appointment conflicts must be detected server-side
- Reminder failures must be logged

---

### 5.4 Consultations

**Status:** Partial  
**Priority:** MEDIUM  

#### Features
- SOAP note entry
- Consultation finalization
- Prescription creation
- Lab test ordering
- ICD-10 diagnosis coding
- Allergy checking

#### Safety Requirements
- Allergy conflicts must trigger visible warnings
- Finalized consultations must be read-only

---

### 5.5 Lab Management

**Status:** Partial  
**Priority:** MEDIUM  

#### Features
- Lab test queue management
- Result entry and review
- Reference ranges per test
- Abnormal result flagging
- Specimen tracking
- Printable lab reports

#### Constraints
- Abnormal results must be visually highlighted
- Result edits must be audit-logged

---

### 5.6 Pharmacy

**Status:** Disabled  
**Priority:** MEDIUM  

#### Features
- Prescription queue
- Medication dispensing workflow
- Inventory management
- Batch tracking
- Expiry date management
- Stock level alerts

#### Known Issues
- TypeScript compilation errors
- Incomplete batch tracking logic

Pharmacy must not be re-enabled until all errors are resolved.

---

## 6. Authentication & Authorization (CRITICAL)

### Requirements
- User login and logout
- Password reset and change
- Session management
- Role-based access control (RBAC)
- User CRUD operations
- Audit logging

### Constraints
- No module may bypass RBAC
- All patient data mutations must be logged
- Sessions must expire automatically

---

## 7. Multi-Tenant Architecture (CRITICAL)

### Requirements
- Every record must include a `tenant_id`
- Tenant filtering must be enforced in all queries
- Tenant isolation must be enforced via middleware
- Cross-tenant access is strictly forbidden

Tenant leakage is considered a **system-fatal defect**.

---

## 8. Offline & Sync Architecture (CRITICAL)

### Sync Engine Requirements
- Automatic sync every 15 minutes
- Manual sync trigger
- Incremental sync (changed records only)
- Nightly full sync (2 AM)
- Device-based authentication
- Priority-based sync queue
- Conflict detection and resolution
- Network failure resilience

### Constraints
- No silent overwrites during sync
- Conflicts must be explicitly surfaced
- Sync behavior must be deterministic and auditable

### Recommended Implementation Strategy
1. Read-only sync
2. One-way write sync
3. Bi-directional sync
4. Conflict resolution strategies

---

## 9. Electron Desktop Application

### Requirements
- Cross-platform support (Windows, macOS, Linux)
- Local SQLite database
- SQLCipher encryption at rest
- Offline detection
- Auto-update mechanism
- System tray integration

### Constraints
- Reuse the same React frontend codebase
- Encryption is mandatory
- Full functionality must be available offline

---

## 10. Reporting & Analytics

**Priority:** LOW  

### Required Reports
- Patient volume trends
- Revenue by service category
- Doctor performance
- Pharmacy inventory
- Lab utilization
- Outstanding balances aging

### Features
- CSV and PDF export
- Date range filtering
- Data visualizations
- Scheduled email reports

---

## 11. Non-Functional Requirements

### Security
- GDPR and NDPR compliance
- Encryption in transit and at rest
- Comprehensive audit logging

### Performance
- Support 100,000+ patient records per clinic
- Optimized queries and indexing

### Reliability
- No data loss on power failure
- Graceful crash recovery

---

## 12. Development Constraints

- Backend: Clean Architecture
- Frontend: React
- Desktop: Electron
- Databases:
  - Server: PostgreSQL
  - Local: SQLite + SQLCipher
- TypeScript across the stack
- No breaking schema changes after sync implementation begins

---

## 13. Success Metrics

- 100% module completion
- Zero tenant data leakage
- Zero silent sync conflicts
- ≥60% automated test coverage
- Successful pilot deployment in live clinics

---

## 14. Out of Scope

- Mobile applications
- Insurance claims processing
- Government EMR integrations
- AI-based diagnostics

---

## 15. Delivery Milestones

1. Authentication and Security Complete
2. Clinical Modules Complete
3. Data Model Freeze
4. Electron Desktop Application
5. Sync Engine
6. Beta Clinic Deployment
7. Production Launch

---

**End of Document**
