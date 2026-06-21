# User Management Module - Quick Start Guide

**Quick Reference**: Implementation checklist and getting started guide

---

## 📋 Implementation Checklist

### Day 1: Backend Authentication (6-8 hours)

**Domain Layer**
- [ ] Create `src/backend/domain/entities/User.entity.ts`
- [ ] Create `src/backend/domain/interfaces/IUserRepository.ts`
- [ ] Create `src/backend/domain/services/user.service.ts`

**Application Layer - Use Cases**
- [ ] `src/backend/application/use-cases/auth/login.use-case.ts`
- [ ] `src/backend/application/use-cases/auth/register.use-case.ts`
- [ ] `src/backend/application/use-cases/auth/logout.use-case.ts`
- [ ] `src/backend/application/use-cases/auth/refresh-token.use-case.ts`
- [ ] `src/backend/application/use-cases/auth/forgot-password.use-case.ts`
- [ ] `src/backend/application/use-cases/auth/reset-password.use-case.ts`

**DTOs & Validators**
- [ ] `src/backend/application/dtos/user/RegisterUser.dto.ts`
- [ ] `src/backend/application/dtos/user/LoginUser.dto.ts`
- [ ] `src/backend/application/dtos/user/ChangePassword.dto.ts`
- [ ] `src/backend/application/dtos/user/ResetPassword.dto.ts`
- [ ] `src/backend/application/validators/user.validator.ts`

**Infrastructure Layer**
- [ ] `src/backend/infrastructure/database/repositories/user.repository.ts`
- [ ] `src/backend/infrastructure/external/email.service.ts`
- [ ] `src/backend/infrastructure/services/token.service.ts`

**Controllers & Middleware**
- [ ] Update `src/backend/presentation/controllers/auth.controller.ts`
- [ ] Create `src/backend/presentation/middleware/audit.middleware.ts`
- [ ] Create `src/backend/presentation/middleware/rate-limit.middleware.ts`

**Database Migrations**
- [ ] Add `PasswordResetToken` model to schema
- [ ] Add `RefreshToken` model to schema
- [ ] Run `npm run prisma:generate`
- [ ] Run `npm run prisma:migrate`

---

### Day 2: Backend User Management (6-8 hours)

**Use Cases**
- [ ] `src/backend/application/use-cases/user/create-user.use-case.ts`
- [ ] `src/backend/application/use-cases/user/update-user.use-case.ts`
- [ ] `src/backend/application/use-cases/user/deactivate-user.use-case.ts`
- [ ] `src/backend/application/use-cases/user/suspend-user.use-case.ts`
- [ ] `src/backend/application/use-cases/user/get-user.use-case.ts`
- [ ] `src/backend/application/use-cases/user/list-users.use-case.ts`
- [ ] `src/backend/application/use-cases/user/change-password.use-case.ts`

**Controllers & Routes**
- [ ] Create `src/backend/presentation/controllers/user.controller.ts`
- [ ] Update `src/backend/presentation/routes/user.routes.ts`
- [ ] Create `src/backend/presentation/middleware/permission.middleware.ts`

**Testing**
- [ ] Test all auth endpoints with Postman/curl
- [ ] Test user CRUD endpoints
- [ ] Test role-based access control
- [ ] Test account lockout mechanism

---

### Day 3: Frontend Authentication (6-8 hours)

**Types & Services**
- [ ] `src/frontend/types/user.types.ts`
- [ ] `src/frontend/services/auth.service.ts`
- [ ] `src/frontend/services/user.service.ts`

**Hooks**
- [ ] `src/frontend/hooks/useAuth.ts`
- [ ] `src/frontend/hooks/usePermission.ts`

**Components**
- [ ] `src/frontend/components/auth/LoginForm.tsx`
- [ ] `src/frontend/components/auth/RegisterForm.tsx`
- [ ] `src/frontend/components/auth/ForgotPasswordForm.tsx`
- [ ] `src/frontend/components/auth/ResetPasswordForm.tsx`
- [ ] `src/frontend/components/auth/SessionTimeoutModal.tsx`
- [ ] `src/frontend/components/auth/PasswordStrengthIndicator.tsx`

**Pages**
- [ ] Update `src/frontend/pages/LoginPage.tsx`
- [ ] Create `src/frontend/pages/ForgotPasswordPage.tsx`
- [ ] Create `src/frontend/pages/ResetPasswordPage.tsx`

**Context & Session Management**
- [ ] Create AuthContext with login/logout functions
- [ ] Implement activity tracker
- [ ] Implement idle timer (30 min)
- [ ] Implement token refresh mechanism

---

### Day 4: Frontend User Management (6-8 hours)

**Components**
- [ ] `src/frontend/components/users/UserList.tsx`
- [ ] `src/frontend/components/users/UserForm.tsx`
- [ ] `src/frontend/components/users/UserDetail.tsx`
- [ ] `src/frontend/components/users/RoleSelector.tsx`
- [ ] `src/frontend/components/users/PermissionMatrix.tsx`
- [ ] `src/frontend/components/users/UserStatusBadge.tsx`
- [ ] `src/frontend/components/users/ActivityLog.tsx`
- [ ] `src/frontend/components/users/PasswordChangeForm.tsx`

**Pages**
- [ ] `src/frontend/pages/users/UsersPage.tsx`
- [ ] `src/frontend/pages/users/CreateUserPage.tsx`
- [ ] `src/frontend/pages/users/EditUserPage.tsx`
- [ ] `src/frontend/pages/users/ProfilePage.tsx`

**Routing**
- [ ] Add user routes to `src/frontend/App.tsx`
- [ ] Create ProtectedRoute component
- [ ] Create RoleRoute component
- [ ] Add "Users" menu item (admin only)

---

## 🚀 Getting Started

### Step 1: Update Database Schema

Add these models to `prisma/schema.prisma`:

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

Then run:
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Step 2: Update Environment Variables

Add to `.env`:

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRY=8h
JWT_REFRESH_EXPIRY=30d

# Password Policy
PASSWORD_MIN_LENGTH=8
BCRYPT_ROUNDS=12

# Account Lockout
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MINUTES=15

# Session
SESSION_TIMEOUT_MINUTES=30

# Email Service
SENDGRID_API_KEY=your-api-key
SENDGRID_FROM_EMAIL=noreply@ssmc.com
```

### Step 3: Install Additional Dependencies (if needed)

```bash
npm install bcrypt jsonwebtoken
npm install @types/bcrypt @types/jsonwebtoken --save-dev
```

### Step 4: Start Implementation

Follow the implementation plan in order:
1. Day 1: Backend Authentication
2. Day 2: Backend User Management
3. Day 3: Frontend Authentication
4. Day 4: Frontend User Management

---

## 📝 Key Implementation Notes

### Password Hashing

```typescript
import bcrypt from 'bcrypt';

// Hash password
const hashedPassword = await bcrypt.hash(password, 12);

// Verify password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### JWT Token Generation

```typescript
import jwt from 'jsonwebtoken';

// Generate token
const token = jwt.sign(
  { id: user.id, email: user.email, role: user.role, tenantId: user.tenantId },
  process.env.JWT_SECRET!,
  { expiresIn: process.env.JWT_EXPIRY || '8h' }
);

// Verify token
const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
```

### Password Validation

```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

function validatePassword(password: string): boolean {
  return passwordRegex.test(password);
}
```

### Account Lockout Logic

```typescript
// Increment failed attempts
if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: failedAttempts + 1,
      lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS)
    }
  });
  throw new Error('Account locked due to too many failed login attempts');
}
```

---

## 🧪 Testing Commands

### Backend Tests

```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@clinic.com","password":"SecurePass123!"}'

# Test protected endpoint
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test forgot password
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@clinic.com"}'
```

### Frontend Tests

1. Open http://localhost:5173/login
2. Test login with valid credentials
3. Test login with invalid credentials (should show error)
4. Test account lockout (5 failed attempts)
5. Test password reset flow
6. Test session timeout (wait 30 minutes)

---

## 📊 API Endpoints Reference

### Authentication
```
POST   /api/auth/register          # Register new user
POST   /api/auth/login             # Login
POST   /api/auth/logout            # Logout
POST   /api/auth/refresh           # Refresh token
POST   /api/auth/forgot-password   # Request password reset
POST   /api/auth/reset-password    # Reset password
GET    /api/auth/me                # Get current user
```

### User Management
```
GET    /api/users                  # List users (admin)
POST   /api/users                  # Create user (admin)
GET    /api/users/:id              # Get user
PUT    /api/users/:id              # Update user
DELETE /api/users/:id              # Deactivate user (admin)
PUT    /api/users/:id/suspend      # Suspend user (admin)
PUT    /api/users/:id/reactivate   # Reactivate user (admin)
```

---

## 🔒 Security Checklist

Before deploying to production:

- [ ] Change JWT_SECRET to strong random string
- [ ] Enable HTTPS only
- [ ] Set secure cookies for refresh tokens
- [ ] Enable CORS with specific origins
- [ ] Add rate limiting on all endpoints
- [ ] Implement CSRF protection
- [ ] Sanitize all user inputs
- [ ] Enable SQL injection protection (Prisma handles this)
- [ ] Add XSS protection headers
- [ ] Implement audit logging
- [ ] Test account lockout mechanism
- [ ] Test password reset flow
- [ ] Verify permission checks on all endpoints
- [ ] Test multi-tenant isolation

---

## 📚 Resources

- Full Implementation Plan: [USER_MANAGEMENT_IMPLEMENTATION_PLAN.md](USER_MANAGEMENT_IMPLEMENTATION_PLAN.md)
- Billing Module Reference: [BILLING_MODULE_COMPLETE.md](BILLING_MODULE_COMPLETE.md)
- Backend Architecture: [src/backend/ARCHITECTURE.md](src/backend/ARCHITECTURE.md)
- Core Requirements: [doc/Core_Requirements.md](doc/Core_Requirements.md)

---

## ✅ Definition of Done

Module is complete when:

**Backend**
- [x] All 6 auth endpoints working
- [x] All 7 user management endpoints working
- [x] Password hashing with bcrypt
- [x] JWT token generation/verification
- [x] Account lockout after 5 failed attempts
- [x] Password reset via email
- [x] Role-based access control enforced
- [x] Audit logging for all actions
- [x] Multi-tenant isolation

**Frontend**
- [x] Login page functional
- [x] Password reset flow complete
- [x] User management UI (create, edit, list)
- [x] Profile management page
- [x] Session timeout with warning
- [x] Token refresh automatic
- [x] Permission-based UI rendering
- [x] Protected routes working

**Testing**
- [x] All endpoints tested
- [x] Role-based access verified
- [x] Account lockout tested
- [x] Password reset flow tested
- [x] Session timeout tested

---

**Start Date**: TBD
**Target Completion**: 4 days from start
**Priority**: HIGH
