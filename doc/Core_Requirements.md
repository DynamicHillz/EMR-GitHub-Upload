# Core Product Requirements  
## SSMC EMR – Offline-First Electronic Medical Records System

**Document Type:** Core Requirements Specification  
**Parent Document:** Product Requirements Document (PRD) – SSMC EMR  
**Version:** 1.0  
**Last Updated:** November 10, 2025  
**Scope:** MVP → Production Readiness  

---

## 1. Purpose

This document defines the **functional and non-functional requirements** that support the SSMC EMR PRD.

It translates the product vision into **explicit, testable system requirements** while respecting the architectural priorities:
- Offline-first operation
- Patient safety
- Security and compliance
- Strict multi-tenant isolation
- Deterministic synchronization behavior

This document must not override the PRD.  
If conflicts exist, the **PRD takes precedence**.

---

## 2. Functional Requirements

---

### 2.1 Patient Management

**Objective:** Maintain a complete, auditable, longitudinal patient record.

**Requirements**
- The system must support patient registration with demographic data.
- The system must generate unique patient identifiers.
- The system must allow patient data updates with a full audit trail.
- The system must store patient medical history (allergies, chronic conditions, blood group, genotype).
- Medical history entries must be append-only.
- The system must provide fast patient search by name, phone number, or patient ID.
- The system must display a consolidated patient record including consultations, prescriptions, and lab results.
- The system must track patient consent with timestamps and version history.
- The system must support patient data export for regulatory compliance.

**Constraints**
- No patient data modification without audit logging.
- Consent withdrawal must immediately restrict further processing.

---

### 2.2 Appointment Scheduling

**Objective:** Manage patient flow and clinician time reliably.

**Requirements**
- The system must support appointment booking with doctor, date, and time.
- The system must prevent double-booking for the same clinician.
- The system must provide calendar-based views (day/week/month).
- The system must support appointment rescheduling and cancellation with reason tracking.
- The system must support patient check-in and waiting queues.
- The system must send automated reminders (SMS/email).

**Constraints**
- Conflict detection must be enforced server-side.
- Reminder failures must be logged and visible to administrators.

---

### 2.3 Consultations & Clinical Documentation

**Objective:** Enable safe, structured clinical encounters.

**Requirements**
- The system must support SOAP-based documentation.
- The system must record patient vital signs.
- The system must allow prescription creation with dosage, frequency, and duration.
- The system must allow laboratory test ordering from consultations.
- The system must support ICD-10 diagnosis code selection.
- The system must automatically surface patient medical history during consultations.
- The system must check prescriptions against known patient allergies.

**Safety Constraints**
- Allergy conflicts must trigger visible warnings.
- Finalized consultations must be read-only.

---

### 2.4 Laboratory Management

**Objective:** Ensure accurate, traceable diagnostic workflows.

**Requirements**
- The system must display lab test queues.
- The system must allow lab staff to update test status.
- The system must support structured result entry with reference ranges.
- The system must flag abnormal results automatically.
- The system must require clinician review before result finalization.
- The system must generate printable lab reports.
- The system must track specimen collection and rejection reasons.

**Constraints**
- All result edits must be audit-logged.
- Abnormal results must be visually emphasized.

---

### 2.5 Pharmacy Management

**Objective:** Ensure safe dispensing and inventory control.

**Requirements**
- The system must display prescriptions pending dispensing.
- The system must record dispensing events with batch number and expiry.
- The system must automatically deduct inventory.
- The system must track stock levels and expiration dates.
- The system must generate low-stock and near-expiry alerts.
- The system must prevent dispensing of allergy-conflicting medications.

**Constraints**
- Pharmacy functionality must remain disabled until compilation errors are resolved.
- Dispensing actions must be immutable and auditable.

---

### 2.6 Billing & Payments

**Objective:** Accurately capture revenue and outstanding balances.

**Requirements**
- The system must generate itemized invoices from completed services.
- The system must support multiple payment methods.
- The system must record payments and issue receipts.
- The system must support partial payments and refunds with approval.
- The system must track outstanding balances.
- Pricing must be configurable per clinic.

**Constraints**
- Finalized invoices must be immutable.
- All financial actions must be logged.

---

### 2.7 User Management & Access Control (CRITICAL)

**Objective:** Prevent unauthorized access and enforce accountability.

**Requirements**
- The system must support secure authentication.
- The system must enforce role-based access control (RBAC).
- The system must allow administrators to manage users.
- The system must enforce session expiration.
- The system must log all sensitive actions in an immutable audit trail.

**Constraints**
- No module may bypass RBAC.
- Authentication must precede offline sync enablement.

---

### 2.8 Multi-Tenancy (CRITICAL)

**Objective:** Guarantee data isolation between clinics.

**Requirements**
- Every record must be associated with a tenant identifier.
- Tenant context must be enforced automatically.
- Cross-tenant access must be prevented at all layers.
- Tenant-specific configurations must be supported.

**Failure Mode**
- Any tenant data leakage is considered a system-fatal defect.

---

### 2.9 Offline Operation

**Objective:** Ensure uninterrupted clinic operations without internet.

**Requirements**
- The system must run as a desktop application.
- The system must operate fully offline.
- The system must use a local encrypted database.
- The system must clearly indicate online/offline status.
- All offline changes must be queued for sync.

**Constraints**
- All clinical workflows must function offline.
- Local data must be encrypted at rest.

---

### 2.10 Data Synchronization (CRITICAL)

**Objective:** Safely reconcile offline and cloud data.

**Requirements**
- The system must support incremental sync.
- The system must support scheduled and manual sync.
- The system must prioritize critical clinical data.
- The system must detect conflicting updates.
- The system must surface unresolved conflicts explicitly.
- The system must support nightly full reconciliation.
- Devices must authenticate using device tokens.

**Constraints**
- No silent overwrites.
- All sync actions must be auditable.
- Conflict resolution must be deterministic.

---

### 2.11 Reporting & Analytics

**Objective:** Provide operational and financial visibility.

**Requirements**
- The system must generate patient volume reports.
- The system must generate revenue reports.
- The system must generate clinician performance reports.
- The system must generate lab and pharmacy utilization reports.
- Reports must be exportable.

---

## 3. Non-Functional Requirements

---

### Security
- Encrypt data in transit and at rest.
- Enforce RBAC on all endpoints.
- Protect against common web vulnerabilities.
- Maintain long-term audit logs.

### Performance
- Support concurrent clinic usage without degradation.
- Ensure fast patient search and record access.

### Reliability
- Prevent data loss during crashes or power failures.
- Support offline continuity during outages.

### Compliance
- GDPR and NDPR compliant.
- Medical and audit record retention enforced.

### Maintainability
- Enforced code standards.
- Versioned schema migrations.
- Centralized logging and error monitoring.

---

## 4. Architecture-Critical Constraints

The following are **non-negotiable**:

1. Offline-first operation
2. Strict tenant isolation
3. Deterministic sync behavior
4. Patient safety enforcement
5. Auditability across all modules
6. No schema breaking after sync implementation

---

## 5. MVP Prioritization

### Phase 1 (Mandatory)
- User Management & RBAC
- Patient Management
- Consultations (core)
- Billing (core)
- Offline operation
- Multi-tenancy enforcement

### Phase 2
- Sync Engine
- Electron desktop packaging
- Pharmacy completion
- Reporting

---

## 6. Status & Next Steps

**Status:** Aligned with PRD  
**Next Steps**
1. Technical architecture specification
2. Database schema finalization
3. API contracts definition
4. Sync engine design
5. Security review

---

**End of Core Requirements Document**
