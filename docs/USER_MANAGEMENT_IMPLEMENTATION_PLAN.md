# User Management Module - Implementation Plan

**Date**: November 22, 2025
**Module**: User Management & Authentication
**Priority**: HIGH (Core Module)
**Estimated Effort**: 3-4 days

---

## Table of Contents

1. [Overview](#overview)
2. [Requirements Coverage](#requirements-coverage)
3. [Current State Analysis](#current-state-analysis)
4. [Architecture Design](#architecture-design)
5. [Implementation Phases](#implementation-phases)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Frontend Components](#frontend-components)
9. [Security Implementation](#security-implementation)
10. [Testing Strategy](#testing-strategy)
11. [Timeline & Milestones](#timeline--milestones)

---

## Overview

The User Management module is a **core foundational module** that provides authentication, authorization, and user administration capabilities for the SSMC EMR system. This module is critical as it secures access to all other modules and enforces role-based permissions across the application.

### Module Scope

- User authentication (login/logout)
- User registration and profile management
- Role-based access control (RBAC)
- Password management (reset, change)
- User lifecycle management (create, activate, deactivate, suspend)
- Session management and token handling
- Audit logging for user actions
- Multi-tenant user isolation

---

## Requirements Coverage

### Functional Requirements (from Core_Requirements.md)

#### REQ-USER-1: Role-Based Access Control (RBAC)
**Requirement**: Support 7 predefined roles with specific permissions

**Roles**:
1. **ADMIN** - Full system access, user management, tenant configuration
2. **DOCTOR** - Patient records, consultations, prescriptions, lab orders
3. **NURSE** - Vital signs, patient check-in, consultation support
4. **LAB_TECH** - Lab test processing, results entry
5. **PHARMACIST** - Medication dispensing, inventory management
6. **CASHIER** - Billing, payment collection, invoice generation
7. **RECEPTIONIST** - Patient registration, appointment scheduling

**Implementation**:
- Enum `UserRole` already defined in Prisma schema
- Middleware `requireRole()` already exists
- Need to define permission matrix per role

#### REQ-USER-2: User Account Management
**Requirement**: Admins create, deactivate, and manage user accounts

**Features**:
- Create new users (admin only)
- Update user profiles
- Deactivate/reactivate users
- Suspend users (temporary)
- View user list with filters
- Search users by name, email, role

#### REQ-USER-3: Strong Password Policy
**Requirement**: Minimum 8 characters, mixed case, numbers, special characters

**Implementation**:
- Password validation on registration/reset
- bcrypt hashing (cost factor 12 - already configured)
- Password strength indicator on frontend
- Reject common/weak passwords

#### REQ-USER-4: Password Reset via Email
**Requirement**: Forgot password functionality with email notification

**Implementation**:
- Generate secure reset token (UUID or JWT)
- Send email with reset link
- Token expiration (15 minutes)
- Verify token before allowing password reset

#### REQ-USER-5: Audit Trail for Sensitive Actions
**Requirement**: Log all user actions in immutable audit trail

**Actions to Log**:
- User login/logout
- Failed login attempts
- User creation/modification/deletion
- Role changes
- Password changes
- Account status changes
- Permission changes

**Implementation**:
- `AuditLog` model already exists in schema
- Create audit logging middleware
- 7-year retention (compliance requirement)

#### REQ-USER-6: Granular Permission Management
**Requirement**: Fine-grained permissions per role

**Permission Categories**:
- Patients: view, create, update, delete
- Appointments: view, create, update, cancel
- Consultations: view, create, update, finalize
- Lab: view, order, process, review
- Pharmacy: view, dispense, manage_inventory
- Billing: view, create_invoice, record_payment, manage_refunds
- Users: view, create, update, deactivate
- Reports: view, export

#### REQ-USER-7: Auto-Logout After Inactivity
**Requirement**: 30 minutes of inactivity triggers logout

**Implementation**:
- Frontend: Activity tracker with idle timer
- Backend: Short-lived JWT (8 hours) with refresh token
- Refresh token rotation for security
- "Remember me" option for 30-day sessions

---

## Current State Analysis

### ✅ Already Implemented

1. **Database Schema**
   - ✅ User model fully defined
   - ✅ UserRole enum (7 roles)
   - ✅ UserStatus enum (ACTIVE, INACTIVE, SUSPENDED)
   - ✅ Security fields (lastLogin, failedLoginAttempts, lockedUntil)
   - ✅ Multi-tenant support (tenantId)
   - ✅ AuditLog model for tracking

2. **Authentication Middleware**
   - ✅ JWT verification (`authMiddleware`)
   - ✅ Role-based authorization (`requireRole()`)
   - ✅ Tenant context validation (`requireTenant`)
   - ✅ Token extraction from Authorization header

3. **Routes Structure**
   - ✅ Auth routes registered (`/api/auth`)
   - ✅ User routes registered (`/api/users`)
   - ✅ Placeholder endpoints defined

4. **Controllers**
   - ✅ Auth controller created (placeholder implementations)
   - ✅ 6 auth endpoints defined:
     - POST /api/auth/register
     - POST /api/auth/login
     - POST /api/auth/logout
     - POST /api/auth/refresh
     - POST /api/auth/forgot-password
     - POST /api/auth/reset-password

### ❌ Not Yet Implemented

1. **Backend**
   - ❌ User CRUD use cases
   - ❌ Authentication use cases
   - ❌ Password hashing/validation logic
   - ❌ Email service integration
   - ❌ Token refresh mechanism
   - ❌ Rate limiting for login attempts
   - ❌ Account lockout after failed attempts
   - ❌ Audit logging implementation
   - ❌ Permission matrix definition

2. **Frontend**
   - ❌ Login page (placeholder exists)
   - ❌ User management dashboard
   - ❌ User creation/edit forms
   - ❌ User list/table
   - ❌ Password reset flow
   - ❌ Profile management page
   - ❌ Role and permission UI
   - ❌ Session timeout handler

---

## Architecture Design

### Backend Architecture

Following Clean Architecture pattern established in the billing module:

```
src/backend/
├── domain/
│   ├── entities/
│   │   └── User.entity.ts              # Domain entity with business logic
│   ├── interfaces/
│   │   └── IUserRepository.ts          # Repository contract
│   └── services/
│       └── user.service.ts             # Business rules (password validation, etc.)
│
├── application/
│   ├── dtos/
│   │   └── user/
│   │       ├── RegisterUser.dto.ts
│   │       ├── UpdateUser.dto.ts
│   │       ├── LoginUser.dto.ts
│   │       ├── ChangePassword.dto.ts
│   │       └── ResetPassword.dto.ts
│   ├── validators/
│   │   └── user.validator.ts           # Joi/Zod validation schemas
│   └── use-cases/
│       ├── auth/
│       │   ├── login.use-case.ts
│       │   ├── logout.use-case.ts
│       │   ├── register.use-case.ts
│       │   ├── refresh-token.use-case.ts
│       │   ├── forgot-password.use-case.ts
│       │   └── reset-password.use-case.ts
│       └── user/
│           ├── create-user.use-case.ts
│           ├── update-user.use-case.ts
│           ├── deactivate-user.use-case.ts
│           ├── suspend-user.use-case.ts
│           ├── get-user.use-case.ts
│           ├── list-users.use-case.ts
│           └── change-password.use-case.ts
│
├── infrastructure/
│   ├── database/
│   │   └── repositories/
│   │       └── user.repository.ts      # Prisma implementation
│   └── external/
│       └── email.service.ts            # SendGrid integration
│
└── presentation/
    ├── controllers/
    │   ├── auth.controller.ts          # ✅ Already exists (update)
    │   └── user.controller.ts          # Create new
    ├── routes/
    │   ├── auth.routes.ts              # ✅ Already exists (update)
    │   └── user.routes.ts              # ✅ Already exists (update)
    └── middleware/
        ├── auth.ts                     # ✅ Already exists
        ├── permission.ts               # Create new (permission checks)
        └── audit.ts                    # Create new (audit logging)
```

### Frontend Architecture

```
src/frontend/
├── components/
│   └── users/
│       ├── UserList.tsx                # User table with filters
│       ├── UserForm.tsx                # Create/edit user
│       ├── UserDetail.tsx              # User profile view
│       ├── PasswordChangeForm.tsx      # Change password
│       ├── PasswordResetForm.tsx       # Reset password
│       ├── RoleSelector.tsx            # Role dropdown
│       └── PermissionMatrix.tsx        # Permission display
│
├── pages/
│   ├── LoginPage.tsx                   # ✅ Already exists (update)
│   ├── users/
│   │   ├── UsersPage.tsx               # User management dashboard
│   │   ├── CreateUserPage.tsx          # User creation page
│   │   ├── EditUserPage.tsx            # User edit page
│   │   └── ProfilePage.tsx             # Current user profile
│   └── ForgotPasswordPage.tsx          # Password reset request
│
├── services/
│   ├── auth.service.ts                 # Authentication API calls
│   └── user.service.ts                 # User management API calls
│
├── types/
│   └── user.types.ts                   # TypeScript interfaces
│
└── hooks/
    ├── useAuth.ts                      # Authentication hook
    ├── useUser.ts                      # User management hook
    └── usePermission.ts                # Permission checking hook
```

---

## Implementation Phases

### Phase 1: Backend - Authentication Core (Day 1)

**Priority**: CRITICAL

#### Tasks

1. **Create Domain Layer**
   - [ ] User.entity.ts (domain entity)
   - [ ] IUserRepository.ts (repository interface)
   - [ ] user.service.ts (password validation, business rules)

2. **Create Application Layer - Auth Use Cases**
   - [ ] login.use-case.ts
     - Verify credentials (bcrypt compare)
     - Check account status (not suspended/inactive)
     - Update lastLogin timestamp
     - Track failed login attempts
     - Lock account after 5 failed attempts (15 minutes)
     - Generate JWT token
     - Log login event

   - [ ] register.use-case.ts
     - Validate password strength
     - Hash password (bcrypt, cost 12)
     - Check for duplicate email
     - Create user record
     - Send welcome email
     - Log registration event

   - [ ] logout.use-case.ts
     - Invalidate token (add to blacklist or use short-lived tokens)
     - Log logout event

   - [ ] refresh-token.use-case.ts
     - Verify refresh token
     - Generate new access token
     - Rotate refresh token
     - Update session expiry

   - [ ] forgot-password.use-case.ts
     - Verify email exists
     - Generate reset token (UUID)
     - Store token with expiry (15 minutes)
     - Send reset email
     - Log password reset request

   - [ ] reset-password.use-case.ts
     - Verify reset token
     - Check token expiry
     - Validate new password
     - Hash new password
     - Update user password
     - Invalidate reset token
     - Log password reset

3. **Create DTOs and Validators**
   - [ ] RegisterUser.dto.ts
   - [ ] LoginUser.dto.ts
   - [ ] ChangePassword.dto.ts
   - [ ] ResetPassword.dto.ts
   - [ ] user.validator.ts (Joi schemas)

4. **Create Infrastructure Layer**
   - [ ] user.repository.ts (Prisma implementation)
   - [ ] email.service.ts (SendGrid integration)
   - [ ] token.service.ts (JWT generation/verification)

5. **Update Controllers**
   - [ ] Implement auth.controller.ts methods
   - [ ] Add proper error handling
   - [ ] Add request validation

6. **Create Middleware**
   - [ ] audit.middleware.ts (audit logging)
   - [ ] rate-limit.middleware.ts (login rate limiting)

**Deliverables**:
- ✅ Fully functional authentication endpoints
- ✅ Password hashing and validation
- ✅ JWT token generation
- ✅ Login rate limiting
- ✅ Account lockout mechanism

---

### Phase 2: Backend - User Management (Day 2)

**Priority**: HIGH

#### Tasks

1. **Create Application Layer - User Use Cases**
   - [ ] create-user.use-case.ts
     - Admin-only operation
     - Validate user data
     - Check duplicate email
     - Hash password
     - Create user
     - Send welcome email
     - Log user creation

   - [ ] update-user.use-case.ts
     - Validate permissions (admin or self)
     - Update user fields
     - Log changes

   - [ ] deactivate-user.use-case.ts
     - Admin-only operation
     - Set status to INACTIVE
     - Invalidate all user sessions
     - Log deactivation

   - [ ] suspend-user.use-case.ts
     - Admin-only operation
     - Set status to SUSPENDED
     - Set lockout period
     - Log suspension

   - [ ] get-user.use-case.ts
     - Fetch user by ID
     - Filter sensitive data based on permissions

   - [ ] list-users.use-case.ts
     - Tenant-scoped query
     - Support filters (role, status, search)
     - Pagination support

   - [ ] change-password.use-case.ts
     - Verify old password
     - Validate new password
     - Hash new password
     - Update password
     - Log password change

2. **Create User Controller**
   - [ ] user.controller.ts
     - GET /api/users - List users
     - POST /api/users - Create user
     - GET /api/users/:id - Get user
     - PUT /api/users/:id - Update user
     - DELETE /api/users/:id - Deactivate user
     - PUT /api/users/:id/suspend - Suspend user
     - PUT /api/users/:id/reactivate - Reactivate user
     - PUT /api/users/:id/change-password - Change password

3. **Update User Routes**
   - [ ] Add all user endpoints
   - [ ] Add role-based middleware (admin-only for create/delete)
   - [ ] Add validation middleware

4. **Create Permission Middleware**
   - [ ] permission.middleware.ts
     - Define permission matrix
     - Check user permissions per endpoint
     - Support both role and resource-level permissions

**Deliverables**:
- ✅ Full user CRUD operations
- ✅ Role-based access control
- ✅ Password management
- ✅ User status management

---

### Phase 3: Frontend - Authentication UI (Day 3)

**Priority**: CRITICAL

#### Tasks

1. **Create Type System**
   - [ ] user.types.ts
     - User interface
     - UserRole enum
     - UserStatus enum
     - LoginRequest/Response
     - RegisterRequest/Response
     - Permission types

2. **Create API Services**
   - [ ] auth.service.ts
     - login()
     - register()
     - logout()
     - refreshToken()
     - forgotPassword()
     - resetPassword()

   - [ ] user.service.ts
     - getUsers()
     - getUser(id)
     - createUser()
     - updateUser(id)
     - deactivateUser(id)
     - suspendUser(id)
     - reactivateUser(id)
     - changePassword(id)

3. **Create Auth Context/Hooks**
   - [ ] useAuth.ts
     - Login/logout functions
     - Current user state
     - Token management
     - Auto-refresh token
     - Session timeout handler

   - [ ] usePermission.ts
     - Check user permissions
     - hasPermission(permission)
     - hasRole(role)
     - Can component

4. **Update Login Page**
   - [ ] LoginPage.tsx
     - Email/password form
     - Form validation
     - Error handling
     - "Remember me" option
     - "Forgot password" link
     - Loading states
     - Redirect after login

5. **Create Password Reset Flow**
   - [ ] ForgotPasswordPage.tsx
     - Email input form
     - Send reset link
     - Success message

   - [ ] ResetPasswordPage.tsx
     - New password form
     - Password strength indicator
     - Confirm password
     - Token verification

6. **Create Session Management**
   - [ ] Activity tracker (mouse, keyboard events)
   - [ ] Idle timer (30 minutes)
   - [ ] Warning modal (5 minutes before timeout)
   - [ ] Auto-logout on timeout
   - [ ] Token refresh mechanism

**Deliverables**:
- ✅ Functional login/logout
- ✅ Password reset flow
- ✅ Session management
- ✅ Token handling

---

### Phase 4: Frontend - User Management UI (Day 4)

**Priority**: HIGH

#### Tasks

1. **Create User Components**
   - [ ] UserList.tsx
     - Table with columns: Name, Email, Role, Status, Last Login
     - Search by name/email
     - Filter by role, status
     - Pagination
     - Sort by columns
     - Actions: View, Edit, Deactivate, Suspend

   - [ ] UserForm.tsx
     - Create/edit form
     - Fields: firstName, lastName, email, phone, role
     - Password field (create only)
     - Role selector
     - Status selector (edit only)
     - Form validation

   - [ ] UserDetail.tsx
     - User profile display
     - Activity history
     - Assigned permissions
     - Recent actions

   - [ ] RoleSelector.tsx
     - Dropdown with 7 roles
     - Role description tooltips

   - [ ] PermissionMatrix.tsx
     - Display permissions per role
     - Checkbox grid
     - Admin-only editing

2. **Create User Pages**
   - [ ] UsersPage.tsx
     - User management dashboard
     - User list with filters
     - "Create User" button (admin only)
     - Bulk actions

   - [ ] CreateUserPage.tsx
     - User creation wizard
     - Step 1: Basic info
     - Step 2: Role and permissions
     - Step 3: Review and submit

   - [ ] EditUserPage.tsx
     - Edit user form
     - Change role
     - Update status
     - Reset password (admin only)

   - [ ] ProfilePage.tsx
     - Current user profile
     - Edit own info
     - Change password
     - Activity log
     - Session management

3. **Create Protected Routes**
   - [ ] ProtectedRoute component
     - Check authentication
     - Redirect to login if not authenticated

   - [ ] RoleRoute component
     - Check user role
     - Show 403 if insufficient permissions

4. **Add Navigation**
   - [ ] Add "Users" menu item (admin only)
   - [ ] Add profile dropdown
   - [ ] Add logout button

**Deliverables**:
- ✅ User management UI
- ✅ User creation/editing
- ✅ Permission management
- ✅ Profile management

---

## Database Schema

### User Model (Already Defined)

```prisma
model User {
  id        String   @id @default(uuid())
  tenantId  String

  // Authentication
  email     String
  password  String    // bcrypt hashed
  username  String?

  // Personal Information
  firstName String
  lastName  String
  phone     String?

  // Role & Permissions
  role      UserRole
  status    UserStatus @default(ACTIVE)

  // Security
  lastLogin DateTime?
  failedLoginAttempts Int @default(0)
  lockedUntil DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  tenant           Tenant
  consultations    Consultation[]
  prescriptions    Prescription[]
  labTestsOrdered  LabTest[] @relation("OrderedBy")
  labTestsReviewed LabTest[] @relation("ReviewedBy")
  dispensingRecords DispensingRecord[]
  appointments     Appointment[]
  invoices         Invoice[]
  payments         Payment[]
  refundsRequested Refund[] @relation("RefundRequester")
  refundsApproved  Refund[] @relation("RefundApprover")
  refundsRejected  Refund[] @relation("RefundRejecter")
  auditLogs        AuditLog[]

  @@unique([tenantId, email])
  @@map("users")
}

enum UserRole {
  ADMIN
  DOCTOR
  NURSE
  LAB_TECH
  PHARMACIST
  CASHIER
  RECEPTIONIST
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}
```

### Additional Models Needed

#### PasswordResetToken Model

```prisma
model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_reset_tokens")
}
```

#### RefreshToken Model

```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}
```

#### Session Model (Optional - for tracking active sessions)

```prisma
model Session {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  ipAddress String?
  userAgent String?
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

---

## API Endpoints

### Authentication Endpoints

```
POST   /api/auth/register            # Register new user
POST   /api/auth/login               # Login user
POST   /api/auth/logout              # Logout user
POST   /api/auth/refresh             # Refresh access token
POST   /api/auth/forgot-password     # Request password reset
POST   /api/auth/reset-password      # Reset password with token
GET    /api/auth/me                  # Get current user info
PUT    /api/auth/change-password     # Change password (authenticated)
```

### User Management Endpoints

```
GET    /api/users                    # List all users (admin/filter by tenant)
POST   /api/users                    # Create new user (admin only)
GET    /api/users/:id                # Get user by ID
PUT    /api/users/:id                # Update user (admin or self for basic info)
DELETE /api/users/:id                # Deactivate user (admin only)
PUT    /api/users/:id/suspend        # Suspend user (admin only)
PUT    /api/users/:id/reactivate     # Reactivate user (admin only)
PUT    /api/users/:id/unlock         # Unlock locked account (admin only)
GET    /api/users/:id/activity       # Get user activity log (admin or self)
GET    /api/users/:id/sessions       # Get active sessions (admin or self)
DELETE /api/users/:id/sessions/:sid  # Revoke session (admin or self)
```

### Permission Endpoints

```
GET    /api/permissions              # Get all permissions
GET    /api/permissions/roles/:role  # Get permissions for role
PUT    /api/permissions/roles/:role  # Update role permissions (admin only)
```

---

## Frontend Components

### Component Breakdown

#### Authentication Components (6 components)

1. **LoginForm.tsx**
   - Props: onSuccess, onForgotPassword
   - State: email, password, rememberMe, loading, error
   - Features: Form validation, error display, loading state

2. **RegisterForm.tsx**
   - Props: onSuccess
   - State: Form fields, validation errors
   - Features: Password strength indicator, terms acceptance

3. **ForgotPasswordForm.tsx**
   - Props: onSuccess
   - State: email, loading, success
   - Features: Email validation, success message

4. **ResetPasswordForm.tsx**
   - Props: token, onSuccess
   - State: password, confirmPassword, loading
   - Features: Password match validation, strength indicator

5. **SessionTimeoutModal.tsx**
   - Props: remainingTime, onExtend, onLogout
   - Features: Countdown timer, extend session button

6. **PasswordStrengthIndicator.tsx**
   - Props: password
   - Features: Visual strength bar, requirements checklist

#### User Management Components (8 components)

1. **UserList.tsx**
   - Props: users, onEdit, onDeactivate, onSuspend
   - Features: Sortable table, filters, search, pagination

2. **UserForm.tsx**
   - Props: user (optional), onSubmit, mode (create/edit)
   - Features: Form validation, role selector, status toggle

3. **UserDetail.tsx**
   - Props: userId
   - Features: Profile display, activity timeline, permissions

4. **RoleSelector.tsx**
   - Props: value, onChange, disabled
   - Features: Dropdown with role descriptions

5. **PermissionMatrix.tsx**
   - Props: role, permissions, editable
   - Features: Checkbox grid, permission categories

6. **UserStatusBadge.tsx**
   - Props: status
   - Features: Colored badge (green/red/yellow)

7. **ActivityLog.tsx**
   - Props: userId
   - Features: Timeline of user actions, filters

8. **PasswordChangeForm.tsx**
   - Props: userId, onSuccess
   - Features: Old/new password validation

---

## Security Implementation

### Password Security

1. **Hashing**
   - Algorithm: bcrypt
   - Cost factor: 12 (configurable via env)
   - Salt: Auto-generated by bcrypt

2. **Password Strength Requirements**
   - Minimum 8 characters
   - At least 1 uppercase letter
   - At least 1 lowercase letter
   - At least 1 number
   - At least 1 special character
   - No common passwords (dictionary check)

3. **Password Validation Regex**
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
```

### Token Security

1. **Access Token (JWT)**
   - Algorithm: HS256 (or RS256 for production)
   - Expiration: 8 hours
   - Payload: { id, email, role, tenantId }
   - Stored: localStorage (frontend)

2. **Refresh Token**
   - Random UUID
   - Expiration: 30 days (or 7 days for non-remember-me)
   - Stored: httpOnly cookie (secure, sameSite)
   - Database: RefreshToken table with revocation support

3. **Password Reset Token**
   - Random UUID
   - Expiration: 15 minutes
   - One-time use only
   - Stored: PasswordResetToken table

### Account Lockout

1. **Failed Login Attempts**
   - Maximum: 5 attempts
   - Lockout duration: 15 minutes
   - Reset counter on successful login
   - Email notification on lockout

2. **Unlock Mechanism**
   - Admin can unlock manually
   - Automatic unlock after lockout period
   - Password reset also unlocks account

### Rate Limiting

1. **Login Endpoint**
   - 5 requests per minute per IP
   - 10 requests per 5 minutes per email

2. **Password Reset**
   - 3 requests per hour per IP
   - 5 requests per day per email

### Audit Logging

**Events to Log**:
- User login (success/failure)
- User logout
- Password change
- Password reset request/completion
- User creation/update/deletion
- Role change
- Status change (active/inactive/suspended)
- Permission modification

**Log Fields**:
- User ID
- Action type
- IP address
- User agent
- Timestamp
- Resource affected
- Changes made (before/after)

---

## Testing Strategy

### Unit Tests

**Backend**:
- [ ] Password hashing/validation functions
- [ ] JWT token generation/verification
- [ ] Use case logic (login, register, etc.)
- [ ] Permission checking logic
- [ ] Password strength validation

**Frontend**:
- [ ] Form validation logic
- [ ] Password strength calculator
- [ ] Permission checking hooks
- [ ] Auth service methods

### Integration Tests

- [ ] Login flow (valid/invalid credentials)
- [ ] Registration flow
- [ ] Password reset flow
- [ ] Token refresh flow
- [ ] Account lockout after failed attempts
- [ ] Role-based access control
- [ ] Session timeout

### E2E Tests

- [ ] Complete login to dashboard flow
- [ ] Admin creates new user
- [ ] User changes password
- [ ] Forgot password flow
- [ ] Session timeout and re-login
- [ ] Unauthorized access attempts

### Security Tests

- [ ] SQL injection attempts
- [ ] XSS in user inputs
- [ ] CSRF token validation
- [ ] Brute force login attempts
- [ ] Token manipulation attempts
- [ ] Privilege escalation attempts

---

## Timeline & Milestones

### Day 1: Backend Authentication Core
- **Hours**: 6-8 hours
- **Deliverables**:
  - ✅ Auth use cases implemented
  - ✅ Password hashing working
  - ✅ JWT token generation
  - ✅ Login/register endpoints functional
  - ✅ Password reset endpoints functional
  - ✅ Rate limiting active
  - ✅ Account lockout working

### Day 2: Backend User Management
- **Hours**: 6-8 hours
- **Deliverables**:
  - ✅ User CRUD use cases
  - ✅ User management endpoints
  - ✅ Permission middleware
  - ✅ Audit logging
  - ✅ Role-based access control
  - ✅ Status management (activate/deactivate/suspend)

### Day 3: Frontend Authentication UI
- **Hours**: 6-8 hours
- **Deliverables**:
  - ✅ Login page functional
  - ✅ Password reset flow
  - ✅ Auth context/hooks
  - ✅ Session management
  - ✅ Token handling
  - ✅ Auto-logout on timeout

### Day 4: Frontend User Management UI
- **Hours**: 6-8 hours
- **Deliverables**:
  - ✅ User list page
  - ✅ User creation/editing
  - ✅ Profile management
  - ✅ Permission UI
  - ✅ Activity log display
  - ✅ Protected routes

### Day 5: Testing & Polish (Optional)
- **Hours**: 4-6 hours
- **Deliverables**:
  - ✅ Unit tests
  - ✅ Integration tests
  - ✅ Bug fixes
  - ✅ Documentation
  - ✅ Performance optimization

---

## Dependencies

### External Services

1. **Email Service** (SendGrid or SMTP)
   - Used for: Password reset emails, welcome emails
   - Configuration: API key in .env
   - Fallback: Console logging in development

2. **Redis** (Optional - for session management)
   - Used for: Token blacklist, session storage
   - Alternative: In-memory or database storage

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=8h
JWT_REFRESH_EXPIRY=30d

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBER=true
PASSWORD_REQUIRE_SPECIAL=true
BCRYPT_ROUNDS=12

# Account Lockout
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# Session
SESSION_TIMEOUT_MINUTES=30
SESSION_WARNING_MINUTES=5

# Email Service (SendGrid)
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=noreply@ssmc.com
SENDGRID_FROM_NAME=SSMC EMR

# Password Reset
RESET_TOKEN_EXPIRY_MINUTES=15
RESET_URL_BASE=http://localhost:5173/reset-password
```

---

## Risk Assessment

### High Risk Items

1. **Password Reset Security**
   - Risk: Token interception or brute force
   - Mitigation: Short expiry, one-time use, rate limiting

2. **JWT Secret Compromise**
   - Risk: Unauthorized access to all accounts
   - Mitigation: Strong secret, rotation policy, environment variable

3. **Account Enumeration**
   - Risk: Attackers can determine valid emails
   - Mitigation: Same response for valid/invalid emails in forgot password

4. **Session Fixation**
   - Risk: Attacker uses known session token
   - Mitigation: Regenerate session on login, rotate refresh tokens

### Medium Risk Items

1. **Mass Assignment**
   - Risk: Users modify restricted fields (role, status)
   - Mitigation: Explicit field whitelisting in DTOs

2. **Broken Access Control**
   - Risk: Users access resources outside their tenant
   - Mitigation: Always filter by tenantId, middleware enforcement

3. **Insecure Direct Object References**
   - Risk: Users access other users by ID manipulation
   - Mitigation: Authorization checks on every endpoint

---

## Success Criteria

### Functional Requirements
- [ ] Users can register and login
- [ ] Users can reset forgotten passwords
- [ ] Admins can create/manage users
- [ ] Role-based access control enforced
- [ ] Password policy enforced
- [ ] Account lockout after failed attempts
- [ ] Session timeout after inactivity
- [ ] Audit logging for all user actions

### Non-Functional Requirements
- [ ] Login response time < 500ms
- [ ] Password hashing time < 200ms
- [ ] Support 50 concurrent logins
- [ ] 99.9% uptime for auth endpoints
- [ ] Zero password leaks (bcrypt hashing)
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

### User Acceptance
- [ ] Login process intuitive
- [ ] Password reset flow clear
- [ ] User management UI easy to use
- [ ] Error messages helpful
- [ ] Session timeout warning not annoying

---

## Next Steps After Implementation

1. **Security Audit**
   - Penetration testing
   - Code security review
   - Dependency vulnerability scan

2. **Performance Optimization**
   - Database query optimization
   - Redis caching for sessions
   - Connection pooling

3. **Enhanced Features**
   - Two-factor authentication (2FA)
   - Single Sign-On (SSO)
   - OAuth integration
   - API key management
   - Biometric authentication

4. **Compliance**
   - GDPR right to erasure
   - Data export for users
   - Consent management
   - Privacy policy acceptance

---

## Appendix

### Permission Matrix

| Permission | ADMIN | DOCTOR | NURSE | LAB_TECH | PHARMACIST | CASHIER | RECEPTIONIST |
|-----------|-------|--------|-------|----------|------------|---------|--------------|
| **Patients** |
| View patients | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create patients | ✅ | ✅ | ✅ | - | - | - | ✅ |
| Update patients | ✅ | ✅ | ✅ | - | - | - | ✅ |
| Delete patients | ✅ | - | - | - | - | - | - |
| **Appointments** |
| View appointments | ✅ | ✅ | ✅ | - | - | - | ✅ |
| Create appointments | ✅ | ✅ | ✅ | - | - | - | ✅ |
| Cancel appointments | ✅ | ✅ | ✅ | - | - | - | ✅ |
| **Consultations** |
| View consultations | ✅ | ✅ | ✅ | - | - | - | - |
| Create consultations | ✅ | ✅ | - | - | - | - | - |
| Finalize consultations | ✅ | ✅ | - | - | - | - | - |
| **Lab Tests** |
| View lab tests | ✅ | ✅ | ✅ | ✅ | - | - | - |
| Order lab tests | ✅ | ✅ | - | - | - | - | - |
| Process lab tests | ✅ | - | - | ✅ | - | - | - |
| Review lab results | ✅ | ✅ | - | - | - | - | - |
| **Pharmacy** |
| View prescriptions | ✅ | ✅ | ✅ | - | ✅ | - | - |
| Dispense medications | ✅ | - | - | - | ✅ | - | - |
| Manage inventory | ✅ | - | - | - | ✅ | - | - |
| **Billing** |
| View invoices | ✅ | ✅ | - | - | - | ✅ | - |
| Create invoices | ✅ | - | - | - | - | ✅ | - |
| Record payments | ✅ | - | - | - | - | ✅ | - |
| Manage refunds | ✅ | - | - | - | - | - | - |
| **Users** |
| View users | ✅ | - | - | - | - | - | - |
| Create users | ✅ | - | - | - | - | - | - |
| Update users | ✅ | - | - | - | - | - | - |
| Deactivate users | ✅ | - | - | - | - | - | - |
| **Reports** |
| View reports | ✅ | ✅ | - | - | - | ✅ | - |
| Export reports | ✅ | ✅ | - | - | - | ✅ | - |

### API Request/Response Examples

#### Login Request
```json
POST /api/auth/login
{
  "email": "doctor@clinic.com",
  "password": "SecurePass123!",
  "rememberMe": true
}
```

#### Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "uuid",
      "email": "doctor@clinic.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "DOCTOR",
      "status": "ACTIVE",
      "tenantId": "clinic-001"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "uuid",
    "expiresIn": 28800
  }
}
```

#### Create User Request
```json
POST /api/users
Authorization: Bearer {admin-token}
{
  "email": "nurse@clinic.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "phone": "+234-123-4567",
  "role": "NURSE",
  "password": "TempPass123!",
  "sendWelcomeEmail": true
}
```

---

**Document Version**: 1.0
**Last Updated**: November 22, 2025
**Status**: READY FOR IMPLEMENTATION
