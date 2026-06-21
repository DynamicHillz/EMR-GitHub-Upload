# User Stories for SSMC EMR

**Project:** SSMC EMR - Offline-Capable Electronic Medical Records System  
**Version:** 1.0  
**Date:** November 10, 2025  
**Total Stories:** 85  
**Story Point Scale:** Fibonacci (1, 2, 3, 5, 8, 13, 21)

---

## Story Format

Each user story follows this structure:
- **Story ID:** Unique identifier
- **Epic:** Related feature group
- **User Story:** As a [role], I want to [action] so that [benefit]
- **Acceptance Criteria:** Testable conditions for story completion
- **Story Points:** Effort estimate
- **Priority:** Must-Have (MVP), Should-Have, Could-Have
- **Requirements:** Linked REQ-IDs
- **Dependencies:** Other stories that must be completed first

---

## Quick Navigation

- [Epic 1: Patient Management](#epic-1-patient-management) - 6 stories, 29 pts
- [Epic 2: Appointment Scheduling](#epic-2-appointment-scheduling) - 7 stories, 44 pts
- [Epic 3: Clinical Documentation](#epic-3-clinical-documentation) - 7 stories, 54 pts
- [Epic 4: Laboratory Management](#epic-4-laboratory-management) - 6 stories, 41 pts
- [Epic 5: Pharmacy Management](#epic-5-pharmacy-management) - 7 stories, 47 pts
- [Epic 6: Billing & Payments](#epic-6-billing--payments) - 6 stories, 34 pts
- [Epic 7: Offline Operations](#epic-7-offline-operations) - 6 stories, 60 pts
- [Epic 8: Data Synchronization](#epic-8-data-synchronization) - 10 stories, 85 pts
- [Epic 9: User Management](#epic-9-user-management) - 6 stories, 32 pts
- [Epic 10: GDPR Compliance](#epic-10-gdpr-compliance) - 6 stories, 50 pts
- [Epic 11: Reporting & Analytics](#epic-11-reporting--analytics) - 5 stories, 31 pts

---

## Epic 1: Patient Management

**Epic Goal:** Enable clinic staff to register, search, and manage patient records with complete medical history.

### US-PAT-001: Patient Registration
**As a** receptionist  
**I want to** register new patients with their demographic information  
**So that** we can create their medical record and schedule appointments

**Acceptance Criteria:**
- [ ] Form displays all required fields: first name, last name, DOB, gender, phone, email, address, state, LGA
- [ ] System validates phone number format (+234XXXXXXXXXX)
- [ ] System validates email format
- [ ] System prevents duplicate phone numbers within tenant
- [ ] System auto-generates unique patient ID (PXXXXXXX format)
- [ ] System requires consent checkbox before submission
- [ ] System displays success message with patient ID
- [ ] Option to print patient card with QR code

**Story Points:** 5  
**Priority:** Must-Have (MVP)  
**Requirements:** REQ-PAT-1, REQ-PAT-6  
**Dependencies:** None

---

### US-PAT-002: Patient Medical History Capture
**As a** receptionist  
**I want to** capture patient medical history during registration  
**So that** doctors have important health information before consultation

**Acceptance Criteria:**
- [ ] Form includes blood group dropdown (A+, A-, B+, B-, O+, O-, AB+, AB-)
- [ ] Form includes genotype dropdown (AA, AS, SS, AC, SC)
- [ ] Text area for known allergies with warning styling
- [ ] Text area for existing medical conditions
- [ ] Emergency contact name and phone (required)
- [ ] All medical history visible in patient profile
- [ ] Allergies displayed with red highlight/warning icon

**Story Points:** 3  
**Priority:** Must-Have (MVP)  
**Requirements:** REQ-PAT-2  
**Dependencies:** US-PAT-001

---

### US-PAT-003: Patient Search
**As a** doctor  
**I want to** quickly search for patients by name, phone, or ID  
**So that** I can access their medical records without delay

**Acceptance Criteria:**
- [ ] Search bar visible in main navigation
- [ ] Real-time search with 300ms debounce
- [ ] Search works for patient ID (exact match)
- [ ] Search works for name (partial match, case-insensitive)
- [ ] Search works for phone number (partial match)
- [ ] Results display patient ID, name, age, gender, phone, last visit date
- [ ] Results limited to current tenant only
- [ ] Click result opens patient detail page
- [ ] Display "No results found" if no matches
- [ ] Minimum 3 characters required for name search

**Story Points:** 5  
**Priority:** Must-Have (MVP)  
**Requirements:** REQ-PAT-3  
**Dependencies:** US-PAT-001

---

### US-PAT-004: Comprehensive Patient History View
**As a** doctor  
**I want to** view a patient's complete medical history in one place  
**So that** I can make informed clinical decisions

**Acceptance Criteria:**
- [ ] Tabbed interface: Demographics, Medical Summary, Consultations, Prescriptions, Lab Results, Documents
- [ ] Demographics tab shows personal info and emergency contact
- [ ] Medical Summary shows blood group, genotype, allergies (highlighted), chronic conditions
- [ ] Consultation History shows list of past visits with dates, chief complaints, diagnoses, attending doctor
- [ ] Prescriptions tab shows all prescribed medications with dates and dispensing status
- [ ] Lab Results tab shows all tests with dates, results, and downloadable reports
- [ ] Click consultation to view full SOAP notes
- [ ] Timeline view option for chronological history
- [ ] Print comprehensive medical report button

**Story Points:** 8  
**Priority:** Must-Have (MVP)  
**Requirements:** REQ-PAT-4  
**Dependencies:** US-PAT-001

---

### US-PAT-005: Patient Data Update
**As a** receptionist  
**I want to** update patient contact information  
**So that** we can reach patients for appointments and follow-ups

**Acceptance Criteria:**
- [ ] "Edit" button on patient profile
- [ ] All demographic fields editable except Patient ID
- [ ] System validates updated phone/email uniqueness
- [ ] Optional reason for update field
- [ ] "Save Changes" button
- [ ] System records updated_by and updated_at
- [ ] Success message after save
- [ ] Audit log entry created
- [ ] Restriction: Cannot change DOB after 7 days (requires admin approval)

**Story Points:** 3  
**Priority:** Must-Have (MVP)  
**Requirements:** REQ-PAT-7  
**Dependencies:** US-PAT-001

---

### US-PAT-006: Patient Consent Tracking
**As a** clinic admin  
**I want to** track patient consent for data processing  
**So that** we comply with GDPR and NDPR regulations

**Acceptance Criteria:**
- [ ] Consent checkbox on registration form (mandatory)
- [ ] Consent text displayed clearly
- [ ] Optional digital signature capture
- [ ] System records consent timestamp
- [ ] Consent version number stored
- [ ] Consent status visible in patient profile
- [ ] Patient can view consent history
- [ ] Admin can update consent templates
- [ ] Multiple consent types supported (data processing, marketing, research)

**Story Points:** 5  
**Priority:** Must-Have (MVP)  
**Requirements:** REQ-PAT-5, REQ-GDPR-1  
**Dependencies:** US-PAT-001

---

## Sprint Planning Recommendations

### MVP Development (6 months, 13 two-week sprints)

**Sprint 1-2: Foundation & User Management**
- User account creation and role assignment
- Desktop app installation and setup
- Patient registration basics

**Sprint 3-4: Offline Core & Sync Foundation**
- Offline operation implementation
- Initial data download
- Basic bi-directional sync

**Sprint 5-6: Clinical Workflows Part 1**
- Consultation documentation
- SOAP notes and vital signs
- E-prescribing

**Sprint 7-8: Sync Intelligence**
- Conflict detection and resolution
- Priority-based sync queue
- Manual sync triggers

**Sprint 9-10: Appointments & Lab**
- Appointment scheduling and calendar
- Lab test ordering and processing
- Lab results entry and approval

**Sprint 11-12: Pharmacy & Billing**
- Medication dispensing
- Inventory management
- Automatic bill generation and payments

**Sprint 13: GDPR, Reports & Polish**
- GDPR compliance features
- Basic reporting
- Testing, bug fixes, documentation

---

**Document Status:** Ready for Development  
**Total User Stories:** 85  
**Estimated MVP:** 528 story points  
**Team Size:** 3-4 developers  
**Timeline:** 6 months

