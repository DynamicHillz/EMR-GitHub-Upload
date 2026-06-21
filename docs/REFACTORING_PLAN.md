# SSMC EMR Codebase Refactoring Plan

## Executive Summary

This document outlines a comprehensive, phased approach to refactor the SSMC EMR codebase based on a thorough audit. The plan addresses critical issues that are causing backend functionality failures, architectural violations, and technical debt.

**Current Status**: ✅ **Phase 1 COMPLETE** (November 26, 2025) - Critical database connection issues resolved. Backend server now stable. See [PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md) for details.

**Next**: Phase 2 - Type Safety & Error Handling

**Goal**: Stable, maintainable codebase following Clean Architecture principles with full test coverage and working features.

---

## Phase 1: Critical Database & Connection Fixes ✅ COMPLETE

**Status**: ✅ **COMPLETED** on November 26, 2025
**Documentation**: See [PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md)

### Objective
Fix the root cause of most backend failures: multiple Prisma client instances and connection management issues.

### Completed Tasks

#### 1.1 Consolidate Prisma Client to Singleton Pattern ✅
**Priority**: CRITICAL
**Completed**: November 26, 2025

**Files Fixed**:
- ✅ `src/backend/presentation/controllers/auth.controller.ts`
- ✅ `src/backend/presentation/controllers/billing.controller.ts`
- ✅ `src/backend/presentation/controllers/user.controller.ts`
- ✅ `src/backend/presentation/middleware/auth.middleware.ts`
- ✅ `src/backend/presentation/middleware/audit.middleware.ts`

**Actions Completed**:
1. ✅ Removed all `new PrismaClient()` instantiations
2. ✅ Replaced with: `import { prisma } from '../../infrastructure/database/prisma.client'`
3. ✅ Verified with grep that no files create new instances
4. ✅ TypeScript compilation passes

**Acceptance Criteria Met**:
- ✅ Only ONE Prisma client instance exists in entire application
- ✅ No "prepared statement already exists" errors
- ✅ All database queries execute successfully

---

#### 1.2 Initialize Database Connection on Server Startup ✅
**Priority**: CRITICAL
**Completed**: November 26, 2025

**File Modified**: `src/backend/server.ts`

**Actions Completed**:
1. ✅ Imported `connectDatabase` and `disconnectDatabase` from prisma.client.ts
2. ✅ Added database connection before Express server startup
3. ✅ Added graceful shutdown handling with database disconnection
4. ✅ Backend server starts successfully with connection logging

**Acceptance Criteria Met**:
- ✅ Server fails fast if database connection fails
- ✅ Clean shutdown disconnects Prisma client
- ✅ Server startup logs show successful database connection

**Server Output**:
```
2025-11-26 10:35:01 [info]: 🔌 Connecting to database...
2025-11-26 10:35:03 [info]: Database connected successfully
2025-11-26 10:35:03 [info]: 🚀 SSMC EMR Server running on port 3000
```

---

#### 1.3 Fix Duplicate Patient Entity Definitions ✅
**Priority**: CRITICAL
**Completed**: November 26, 2025

**Problem Resolved**: Two conflicting entity files existed - consolidated to one

**Actions Completed**:
1. ✅ **Deleted** `src/backend/domain/entities/Patient.ts`
2. ✅ Updated 3 files to import from `Patient.entity.ts`:
   - `src/backend/domain/services/patient.service.ts`
   - `src/backend/domain/interfaces/IPatientRepository.ts`
   - `src/backend/infrastructure/database/repositories/patient.repository.ts`
3. ✅ Updated all return types from `Patient` to `PatientEntity`
4. ✅ Simplified repository `mapToEntity()` to use `PatientEntity.fromDatabase()`
5. ✅ Fixed patient.service.ts to use PatientEntity methods directly

   // NEW (use everywhere)
   import { PatientEntity } from '../../../domain/entities/Patient.entity';
   ```
4. Update repository to return `PatientEntity`:
   ```typescript
   async findById(id: string, tenantId: string): Promise<PatientEntity | null>
   ```
5. Fix `fromDatabase` method in `Patient.entity.ts`:
   ```typescript
   static fromDatabase(data: any): PatientEntity {
     return new PatientEntity(
       data.id,
       data.tenantId,
       data.patientId, // Database field name
       // ... other fields
     );
   }
   ```

**Files to Update**:
- [ ] `src/backend/domain/entities/Patient.entity.ts` (fix constructor)
- [ ] `src/backend/infrastructure/database/repositories/patient.repository.ts` (update return types)
- [ ] `src/backend/application/use-cases/patient/*.ts` (update imports)
- [ ] Delete `src/backend/domain/entities/Patient.ts`

**Acceptance Criteria Met**:
- ✅ Only ONE Patient entity definition exists
- ✅ All patient-related types compile correctly
- ✅ PatientEntity properly integrated with Prisma types
- ✅ No TypeScript compilation errors

---

#### 1.4 Create Database Connection Health Check Script ✅
**Priority**: HIGH
**Completed**: November 26, 2025

**File Created**: `src/backend/scripts/check-db-connection.ts`

**Actions Completed**:
1. ✅ Created comprehensive health check script with:
   - Database connection test
   - PostgreSQL version check
   - Critical tables verification
   - Record counts for each table
   - Connection pool information
   - Clear error messages with troubleshooting steps
2. ✅ Added npm script: `"db:check": "ts-node src/backend/scripts/check-db-connection.ts"`
3. ✅ Tested script successfully

**Features**:
```bash
npm run db:check
```
- ✅ Tests database connection
- ✅ Shows PostgreSQL version
- ✅ Verifies 8 critical tables exist
- ✅ Displays record counts
- ✅ Provides troubleshooting guidance on failure

**Acceptance Criteria Met**:
- ✅ Script verifies database connectivity
- ✅ Clear success/failure output
- ✅ Helpful error messages for debugging
- ✅ npm script for easy execution
  }
}

checkConnection();
```

**Add to package.json**:
```json
"scripts": {
  "db:check": "ts-node src/backend/scripts/check-db-connection.ts"
}
```

**Acceptance Criteria**:
- Script successfully connects to database
- Returns count of records
- Can be run before deployments

---

## Phase 2: Type Safety & Error Handling (Week 2)

### Objective
Remove `as any` casts, implement proper error handling, and improve type safety throughout the codebase.

### Tasks

#### 2.1 Replace All `as any` with Proper Types
**Priority**: HIGH
**Estimated Time**: 8 hours

**Strategy**: Create proper type definitions for Express Request extensions

**File**: Create `src/backend/types/express.d.ts`
```typescript
import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        tenantId: string;
      };
    }
  }
}
```

**Actions**:
1. Create Express type extensions (above)
2. Find and replace `(req as any).user` with `req.user` (will be properly typed)
3. Replace query parameter casts:
   ```typescript
   // OLD
   gender: req.query.gender as any

   // NEW
   gender: req.query.gender as Gender | undefined
   ```
4. Fix repository `mapToEntity` methods:
   ```typescript
   // OLD
   private mapToEntity(patient: any): Patient

   // NEW
   import { Patient as PrismaPatient } from '@prisma/client';
   private mapToEntity(patient: PrismaPatient): PatientEntity
   ```

**Files to Fix** (sample, ~50 total occurrences):
- [ ] `src/backend/presentation/controllers/patient.controller.ts`
- [ ] `src/backend/presentation/controllers/billing.controller.ts`
- [ ] `src/backend/presentation/controllers/user.controller.ts`
- [ ] `src/backend/infrastructure/database/repositories/*.ts`
- [ ] `src/backend/infrastructure/services/token.service.ts`

**Acceptance Criteria**:
- Zero `as any` casts remain (except JSON parsing where unavoidable)
- TypeScript strict mode passes
- All HTTP request handlers properly typed

---

#### 2.2 Implement AppError Throughout Use Cases
**Priority**: HIGH
**Estimated Time**: 6 hours

**File**: `src/backend/shared/errors/AppError.ts` (verify exists and has proper structure)

**Expected AppError Class**:
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}
```

**Actions**:
1. Replace all `throw new Error()` with `throw new AppError()`:
   ```typescript
   // OLD
   throw new Error('Patient not found');

   // NEW
   throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
   ```
2. Create error code constants file:
   ```typescript
   // src/backend/shared/constants/error-codes.ts
   export const ErrorCodes = {
     PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
     CONSULTATION_NOT_FOUND: 'CONSULTATION_NOT_FOUND',
     UNAUTHORIZED: 'UNAUTHORIZED',
     // ... etc
   } as const;
   ```
3. Update error handler middleware to properly format AppError responses
4. Remove string matching in controllers:
   ```typescript
   // OLD
   if (error.message.includes('already exists')) {
     return res.status(409).json(...)
   }

   // NEW
   // Let global error handler deal with it (AppError has statusCode)
   throw new AppError('Patient already exists', 409, 'PATIENT_EXISTS');
   ```

**Files to Update** (~25 use case files):
- [ ] `src/backend/application/use-cases/patient/*.ts`
- [ ] `src/backend/application/use-cases/consultation/*.ts`
- [ ] `src/backend/application/use-cases/lab/*.ts`
- [ ] `src/backend/application/use-cases/billing/*.ts`
- [ ] `src/backend/application/use-cases/user/*.ts`
- [ ] `src/backend/presentation/middleware/errorHandler.ts` (update to handle AppError)

**Acceptance Criteria**:
- All use cases throw AppError with proper status codes
- Global error handler returns consistent JSON format
- Error codes are machine-readable
- Stack traces only in development

---

#### 2.3 Replace Console Logging with Winston Logger
**Priority**: HIGH
**Estimated Time**: 3 hours

**Actions**:
1. Create logger utility wrapper:
   ```typescript
   // src/backend/shared/utils/logger.ts
   import { logger } from '../../config/logger';
   export { logger };
   ```
2. Find and replace all `console.error`:
   ```typescript
   // OLD
   console.error('Error booking appointment:', error);

   // NEW
   logger.error('Error booking appointment', { error, context: 'appointment.controller' });
   ```
3. Replace all `console.log`:
   ```typescript
   // OLD
   console.log('Email sent successfully');

   // NEW
   logger.info('Email sent successfully', { to: recipientEmail });
   ```

**Files to Update** (~40 files):
- [ ] All controllers in `src/backend/presentation/controllers/`
- [ ] All services in `src/backend/infrastructure/services/`
- [ ] `src/backend/domain/entities/Consultation.entity.ts:161`

**Acceptance Criteria**:
- Zero `console.error` or `console.log` in production code
- All logs include context objects
- Log levels properly used (error, warn, info, debug)

---

## Phase 3: Validation & Data Consistency (Week 3)

### Objective
Fix validation schema inconsistencies and ensure data flows correctly between layers.

### Tasks

#### 3.1 Fix Validator Schema Inconsistencies
**Priority**: MEDIUM
**Estimated Time**: 4 hours

**File**: `src/backend/application/validators/patient.validator.ts`

**Actions**:
1. Make phone number validation international-friendly:
   ```typescript
   // OLD
   phone: Joi.string().pattern(/^\+234\d{10}$/).required()

   // NEW
   phone: Joi.string().pattern(/^\+?[\d\s\-()]+$/).min(10).max(20).required()
     .messages({
       'string.pattern.base': 'Phone must be a valid international format'
     })
   ```
2. Make state field optional (not all countries have states):
   ```typescript
   state: Joi.string().optional().allow('', null),
   ```
3. Align create and update schemas:
   - Use same phone pattern
   - Use same field optionality rules
4. Add proper email validation:
   ```typescript
   email: Joi.string().email().optional().allow('', null),
   ```

**Files to Update**:
- [ ] `src/backend/application/validators/patient.validator.ts`
- [ ] `src/backend/application/validators/user.validator.ts`
- [ ] `src/backend/application/validators/billing.validator.ts`
- [ ] `src/backend/application/validators/appointment.validator.ts`

**Acceptance Criteria**:
- International phone numbers accepted
- Create and update schemas consistent
- Clear validation error messages

---

#### 3.2 Standardize Field Naming: patientId
**Priority**: MEDIUM
**Estimated Time**: 5 hours

**Decision**: Use `patientId` everywhere (matches database schema)

**Actions**:
1. Update DTOs to use `patientId`:
   ```typescript
   // src/backend/application/dtos/patient/*.dto.ts
   export interface PatientResponseDto {
     id: string;
     patientId: string; // NOT patientNumber
     // ...
   }
   ```
2. Update repository mappings:
   ```typescript
   // Repository maps DB patientId → patientId
   private mapToEntity(patient: PrismaPatient): PatientEntity {
     return {
       id: patient.id,
       patientId: patient.patientId, // Direct mapping
       // ...
     };
   }
   ```
3. Update use cases to use `patientId` consistently
4. Update frontend types:
   ```typescript
   // src/frontend/types/patient.types.ts
   export interface Patient {
     id: string;
     patientId: string; // Consistent with backend
     // ...
   }
   ```

**Files to Update**:
- [ ] All DTOs in `src/backend/application/dtos/patient/`
- [ ] Patient entity constructor parameter name
- [ ] All repositories
- [ ] Frontend type definitions

**Acceptance Criteria**:
- No field named `patientNumber` exists
- All code uses `patientId`
- Frontend displays patient ID correctly
- No mapping confusion

---

#### 3.3 Add Tenant Validation Middleware
**Priority**: MEDIUM
**Estimated Time**: 2 hours

**File**: Create `src/backend/presentation/middleware/tenant.middleware.ts`

**Content**:
```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors/AppError';

export function requireTenant(req: Request, res: Response, next: NextFunction) {
  const tenantId = req.user?.tenantId;

  if (!tenantId) {
    throw new AppError('Tenant ID missing from authentication context', 401, 'NO_TENANT');
  }

  // Attach to request for easy access
  (req as any).tenantId = tenantId;
  next();
}

export function validateTenantAccess(resourceTenantId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userTenantId = req.user?.tenantId;

    if (resourceTenantId !== userTenantId) {
      throw new AppError('Access denied: Resource belongs to different tenant', 403, 'TENANT_MISMATCH');
    }

    next();
  };
}
```

**Actions**:
1. Create middleware (above)
2. Apply to all protected routes:
   ```typescript
   // In route files
   router.post('/patients', authenticate, requireTenant, registerPatient);
   ```
3. Remove inline tenant checks from controllers
4. Use consistent error responses

**Files to Update**:
- [ ] All route files in `src/backend/presentation/routes/`
- [ ] Remove inline tenant validation from controllers

**Acceptance Criteria**:
- All routes check tenant access
- Consistent error messages
- Controllers simplified (no inline checks)

---

## Phase 4: Complete Incomplete Features (Week 4)

### Objective
Finish half-implemented features causing TODO comments and broken functionality.

### Tasks

#### 4.1 Implement Drug Interaction Checking
**Priority**: HIGH
**Estimated Time**: 12 hours

**File**: `src/backend/application/use-cases/consultation/create-prescription.use-case.ts:84`

**Research Required**: Find drug interaction API or database
- Option 1: FDA Drug Interaction API
- Option 2: OpenFDA API
- Option 3: Local drug interaction database

**Actions**:
1. Create drug interaction service:
   ```typescript
   // src/backend/infrastructure/services/drug-interaction.service.ts
   export class DrugInteractionService {
     async checkInteractions(medications: string[]): Promise<{
       hasInteractions: boolean;
       warnings: string[];
     }> {
       // Implementation
     }
   }
   ```
2. Update prescription use case:
   ```typescript
   const interactions = await this.drugInteractionService.checkInteractions(
     dto.medications.map(m => m.medication)
   );

   interactionWarning: interactions.hasInteractions,
   interactionDetails: interactions.warnings
   ```
3. Add to prescription response DTO
4. Display warnings in frontend

**Files to Create/Update**:
- [ ] Create `src/backend/infrastructure/services/drug-interaction.service.ts`
- [ ] Update `src/backend/application/use-cases/consultation/create-prescription.use-case.ts`
- [ ] Update prescription DTOs
- [ ] Update frontend prescription display

**Acceptance Criteria**:
- Drug interactions are checked before prescription creation
- Warnings displayed to doctors
- Dangerous combinations blocked or require confirmation

---

#### 4.2 Implement Real Email Service
**Priority**: HIGH
**Estimated Time**: 6 hours

**File**: `src/backend/infrastructure/services/email.service.ts`

**Actions**:
1. Uncomment and complete SendGrid implementation:
   ```typescript
   import sgMail from '@sendgrid/mail';

   constructor() {
     if (process.env.SENDGRID_API_KEY) {
       sgMail.setApiKey(process.env.SENDGRID_API_KEY);
     }
   }

   async sendEmail(to: string, subject: string, html: string): Promise<void> {
     if (process.env.NODE_ENV === 'development') {
       logger.info('Email would be sent', { to, subject });
       return;
     }

     try {
       await sgMail.send({
         to,
         from: process.env.FROM_EMAIL!,
         subject,
         html
       });
       logger.info('Email sent successfully', { to, subject });
     } catch (error) {
       logger.error('Email send failed', { error, to, subject });
       throw new AppError('Failed to send email', 500, 'EMAIL_SEND_FAILED');
     }
   }
   ```
2. Add SendGrid API key to `.env`:
   ```
   SENDGRID_API_KEY=your_key_here
   FROM_EMAIL=noreply@yourdomain.com
   ```
3. Test email sending
4. Add email templates for common scenarios

**Files to Update**:
- [ ] `src/backend/infrastructure/services/email.service.ts`
- [ ] `.env.example` (add SendGrid keys)
- [ ] Update calls to use async email sending

**Acceptance Criteria**:
- Emails sent successfully in production
- Development mode logs emails (doesn't send)
- Failed emails logged with context
- Email templates exist for common scenarios

---

#### 4.3 Implement SMS Service
**Priority**: MEDIUM
**Estimated Time**: 6 hours

**File**: `src/backend/infrastructure/external/sms.service.ts`

**Provider Options**:
- Twilio (international)
- Africa's Talking (African markets)
- Termii (Nigeria)

**Actions**:
1. Choose SMS provider based on target market
2. Implement provider integration:
   ```typescript
   import { Twilio } from 'twilio';

   export class SmsService {
     private client: Twilio;

     constructor() {
       this.client = new Twilio(
         process.env.TWILIO_ACCOUNT_SID!,
         process.env.TWILIO_AUTH_TOKEN!
       );
     }

     async sendSms(to: string, message: string): Promise<void> {
       if (process.env.NODE_ENV === 'development') {
         logger.info('SMS would be sent', { to, message });
         return;
       }

       try {
         await this.client.messages.create({
           body: message,
           to,
           from: process.env.TWILIO_PHONE_NUMBER!
         });
         logger.info('SMS sent successfully', { to });
       } catch (error) {
         logger.error('SMS send failed', { error, to });
         throw new AppError('Failed to send SMS', 500, 'SMS_SEND_FAILED');
       }
     }
   }
   ```
3. Add Twilio credentials to `.env`
4. Test SMS sending
5. Add SMS templates for appointment reminders

**Files to Update**:
- [ ] `src/backend/infrastructure/external/sms.service.ts`
- [ ] `.env.example` (add Twilio credentials)
- [ ] Update appointment reminder logic

**Acceptance Criteria**:
- SMS sent successfully in production
- Development mode logs SMS (doesn't send)
- Failed SMS logged with context
- Appointment reminders work

---

#### 4.4 Get Real Doctor Name in Consultations
**Priority**: MEDIUM
**Estimated Time**: 2 hours

**File**: `src/backend/application/use-cases/consultation/create-consultation.use-case.ts:60`

**Actions**:
1. Add user query to fetch doctor info:
   ```typescript
   // In use case constructor, add UserRepository
   constructor(
     private consultationRepository: IConsultationRepository,
     private patientRepository: IPatientRepository,
     private userRepository: IUserRepository // Add this
   ) {}

   // In execute method
   const doctor = await this.userRepository.findById(doctorId, tenantId);
   if (!doctor) {
     throw new AppError('Doctor not found', 404, 'DOCTOR_NOT_FOUND');
   }

   doctorName: `${doctor.firstName} ${doctor.lastName}`,
   ```
2. Update controller to pass doctorId from auth context:
   ```typescript
   const doctorId = req.user!.id;
   await createConsultationUseCase.execute(dto, tenantId, doctorId);
   ```
3. Update use case signature to accept doctorId parameter

**Files to Update**:
- [ ] `src/backend/application/use-cases/consultation/create-consultation.use-case.ts`
- [ ] `src/backend/presentation/controllers/consultation.controller.ts`
- [ ] User repository (ensure findById method exists)

**Acceptance Criteria**:
- Consultation records show actual doctor name
- Doctor name displayed correctly in frontend
- Error if doctor not found

---

#### 4.5 Pharmacy Module Decision
**Priority**: HIGH
**Estimated Time**: 4 hours (if removing) OR 40 hours (if completing)

**File**: `src/backend/server.ts:17,81`

**Option A: Remove Pharmacy Module** (Recommended if not needed immediately)
1. Delete pharmacy controller, routes, use cases
2. Remove from documentation
3. Add to future roadmap

**Option B: Complete Pharmacy Module**
1. Fix TypeScript errors in controller
2. Enable routes in server.ts
3. Test all endpoints
4. Add medication stock management
5. Add dispensing workflow
6. Add drug barcode scanning support

**Decision Required**: Consult with stakeholders on pharmacy module priority

**Actions** (if keeping):
- [ ] Fix TypeScript compilation errors
- [ ] Uncomment routes in server.ts
- [ ] Add missing use cases
- [ ] Implement stock management
- [ ] Add tests

**Acceptance Criteria** (if keeping):
- All pharmacy endpoints functional
- Stock levels tracked
- Dispensing workflow complete
- Tests passing

**Acceptance Criteria** (if removing):
- All pharmacy code removed
- Documentation updated
- No broken references

---

## Phase 5: Testing Infrastructure (Week 5)

### Objective
Add comprehensive test coverage to prevent regressions and enable confident refactoring.

### Tasks

#### 5.1 Setup Testing Infrastructure
**Priority**: HIGH
**Estimated Time**: 6 hours

**Actions**:
1. Verify Jest configuration exists and is correct
2. Add test utilities:
   ```typescript
   // src/backend/__tests__/helpers/test-helpers.ts
   import { PrismaClient } from '@prisma/client';

   export function createTestPrisma(): PrismaClient {
     return new PrismaClient({
       datasources: {
         db: {
           url: process.env.TEST_DATABASE_URL
         }
       }
     });
   }

   export async function cleanDatabase(prisma: PrismaClient) {
     // Truncate all tables
     await prisma.$executeRawUnsafe('TRUNCATE TABLE users CASCADE');
     // ... other tables
   }
   ```
3. Create test database:
   ```bash
   # Add to .env.test
   TEST_DATABASE_URL="postgresql://..."
   ```
4. Add test scripts to package.json:
   ```json
   "scripts": {
     "test": "jest",
     "test:watch": "jest --watch",
     "test:coverage": "jest --coverage",
     "test:integration": "jest --testPathPattern=integration"
   }
   ```

**Files to Create**:
- [ ] `src/backend/__tests__/helpers/test-helpers.ts`
- [ ] `jest.config.js` (verify/update)
- [ ] `.env.test`

**Acceptance Criteria**:
- Jest runs successfully
- Test database configured
- Helper utilities available

---

#### 5.2 Write Unit Tests for Use Cases
**Priority**: HIGH
**Estimated Time**: 20 hours

**Strategy**: Test use cases in isolation with mocked repositories

**Example**:
```typescript
// src/backend/application/use-cases/patient/__tests__/register-patient.use-case.spec.ts
import { RegisterPatientUseCase } from '../register-patient.use-case';
import { IPatientRepository } from '../../../../domain/interfaces/IPatientRepository';
import { PatientIdGenerator } from '../../../../infrastructure/generators/patient-id.generator';

describe('RegisterPatientUseCase', () => {
  let useCase: RegisterPatientUseCase;
  let mockPatientRepo: jest.Mocked<IPatientRepository>;
  let mockIdGenerator: jest.Mocked<PatientIdGenerator>;

  beforeEach(() => {
    mockPatientRepo = {
      create: jest.fn(),
      search: jest.fn(),
      findById: jest.fn(),
    } as any;

    mockIdGenerator = {
      generatePatientId: jest.fn().mockResolvedValue('P0000001'),
    } as any;

    useCase = new RegisterPatientUseCase(mockPatientRepo, mockIdGenerator);
  });

  describe('execute', () => {
    it('should generate patient ID and create patient', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        gender: 'MALE',
        phone: '+2348012345678',
        state: 'Lagos',
        emergencyContact: {
          name: 'Jane Doe',
          phone: '+2348000000000',
          relationship: 'Spouse'
        },
        consentGiven: true
      };

      mockPatientRepo.search.mockResolvedValue({ patients: [], total: 0 });
      mockPatientRepo.create.mockResolvedValue({
        id: 'uuid',
        patientId: 'P0000001',
        ...dto
      } as any);

      const result = await useCase.execute(dto, 'tenant-id');

      expect(mockIdGenerator.generatePatientId).toHaveBeenCalledWith('tenant-id');
      expect(mockPatientRepo.search).toHaveBeenCalledWith({
        tenantId: 'tenant-id',
        query: dto.phone,
        take: 1
      });
      expect(mockPatientRepo.create).toHaveBeenCalled();
      expect(result.patientId).toBe('P0000001');
    });

    it('should throw error if phone number already exists', async () => {
      const dto = { /* ... */ };

      mockPatientRepo.search.mockResolvedValue({
        patients: [{ id: 'existing-id' }] as any,
        total: 1
      });

      await expect(useCase.execute(dto, 'tenant-id'))
        .rejects
        .toThrow('A patient with this phone number already exists');

      expect(mockPatientRepo.create).not.toHaveBeenCalled();
    });
  });
});
```

**Test Coverage Targets**:
- [ ] Patient use cases: 80% coverage
- [ ] Consultation use cases: 80% coverage
- [ ] Lab use cases: 80% coverage
- [ ] Billing use cases: 80% coverage
- [ ] User use cases: 80% coverage

**Estimated**: 4 hours per module × 5 modules = 20 hours

**Acceptance Criteria**:
- All use cases have unit tests
- Edge cases covered
- Error scenarios tested
- 80%+ code coverage for use cases

---

#### 5.3 Write Integration Tests for API Endpoints
**Priority**: MEDIUM
**Estimated Time**: 16 hours

**Strategy**: Test complete request/response cycle with real database

**Example**:
```typescript
// src/backend/__tests__/integration/patient.integration.spec.ts
import request from 'supertest';
import { app } from '../../server';
import { createTestPrisma, cleanDatabase } from '../helpers/test-helpers';

describe('Patient API Integration Tests', () => {
  let prisma: PrismaClient;
  let authToken: string;

  beforeAll(async () => {
    prisma = createTestPrisma();
    // Create test tenant and user
    // Get auth token
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await prisma.$disconnect();
  });

  describe('POST /api/patients', () => {
    it('should register a new patient', async () => {
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          gender: 'MALE',
          phone: '+2348012345678',
          state: 'Lagos',
          emergencyContact: {
            name: 'Jane Doe',
            phone: '+2348000000000',
            relationship: 'Spouse'
          },
          consentGiven: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patientId).toMatch(/^P\d{7}$/);
      expect(response.body.data.firstName).toBe('John');
    });

    it('should return 409 if phone number already exists', async () => {
      // First registration
      await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ /* data */ });

      // Duplicate registration
      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ /* same phone */ });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/patients')
        .send({ /* data */ });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/patients/search', () => {
    it('should search patients by name', async () => {
      // Create test patient
      await createTestPatient(prisma, { firstName: 'Alice' });

      const response = await request(app)
        .get('/api/patients/search?query=Alice')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].firstName).toBe('Alice');
    });
  });
});
```

**Test Coverage Targets**:
- [ ] Patient endpoints: All covered
- [ ] Consultation endpoints: All covered
- [ ] Lab endpoints: All covered
- [ ] Billing endpoints: All covered
- [ ] User endpoints: All covered
- [ ] Auth endpoints: All covered

**Estimated**: ~8 endpoints per module × 2 hours = 16 hours

**Acceptance Criteria**:
- All API endpoints have integration tests
- Happy path and error scenarios covered
- Authentication tested
- Multi-tenancy isolation tested

---

## Phase 6: Documentation & Code Quality (Week 6)

### Objective
Add API documentation, improve code comments, and enforce code quality standards.

### Tasks

#### 6.1 Add Swagger/OpenAPI Documentation
**Priority**: MEDIUM
**Estimated Time**: 8 hours

**Actions**:
1. Install Swagger dependencies:
   ```bash
   npm install swagger-ui-express swagger-jsdoc @types/swagger-ui-express @types/swagger-jsdoc
   ```
2. Create Swagger configuration:
   ```typescript
   // src/backend/config/swagger.ts
   import swaggerJsdoc from 'swagger-jsdoc';

   const options = {
     definition: {
       openapi: '3.0.0',
       info: {
         title: 'SSMC EMR API',
         version: '1.0.0',
         description: 'Electronic Medical Records API'
       },
       servers: [
         { url: 'http://localhost:3000', description: 'Development' }
       ],
       components: {
         securitySchemes: {
           bearerAuth: {
             type: 'http',
             scheme: 'bearer',
             bearerFormat: 'JWT'
           }
         }
       }
     },
     apis: ['./src/backend/presentation/routes/*.ts']
   };

   export const swaggerSpec = swaggerJsdoc(options);
   ```
3. Add Swagger UI to server:
   ```typescript
   // In server.ts
   import swaggerUi from 'swagger-ui-express';
   import { swaggerSpec } from './config/swagger';

   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
   ```
4. Add JSDoc comments to routes:
   ```typescript
   /**
    * @swagger
    * /api/patients:
    *   post:
    *     summary: Register a new patient
    *     tags: [Patients]
    *     security:
    *       - bearerAuth: []
    *     requestBody:
    *       required: true
    *       content:
    *         application/json:
    *           schema:
    *             $ref: '#/components/schemas/CreatePatientDto'
    *     responses:
    *       201:
    *         description: Patient registered successfully
    *       409:
    *         description: Phone number already exists
    */
   router.post('/patients', authenticate, registerPatient);
   ```

**Files to Create/Update**:
- [ ] Create `src/backend/config/swagger.ts`
- [ ] Update `src/backend/server.ts` (add Swagger middleware)
- [ ] Add JSDoc to all routes

**Acceptance Criteria**:
- Swagger UI accessible at `/api-docs`
- All endpoints documented
- Request/response schemas defined
- Authentication documented

---

#### 6.2 Add ESLint and Prettier Configuration
**Priority**: LOW
**Estimated Time**: 4 hours

**Actions**:
1. Create ESLint config:
   ```json
   // .eslintrc.json
   {
     "extends": [
       "eslint:recommended",
       "plugin:@typescript-eslint/recommended"
     ],
     "parser": "@typescript-eslint/parser",
     "plugins": ["@typescript-eslint"],
     "rules": {
       "@typescript-eslint/no-explicit-any": "error",
       "@typescript-eslint/explicit-function-return-type": "warn",
       "no-console": "error"
     }
   }
   ```
2. Create Prettier config:
   ```json
   // .prettierrc
   {
     "semi": true,
     "trailingComma": "es5",
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2
   }
   ```
3. Add pre-commit hook with Husky:
   ```bash
   npm install -D husky lint-staged
   npx husky install
   ```
4. Configure lint-staged:
   ```json
   // package.json
   {
     "lint-staged": {
       "*.ts": ["eslint --fix", "prettier --write"]
     }
   }
   ```

**Files to Create**:
- [ ] `.eslintrc.json`
- [ ] `.prettierrc`
- [ ] `.husky/pre-commit`

**Acceptance Criteria**:
- ESLint catches type errors
- Prettier formats code automatically
- Pre-commit hooks run
- No console.* allowed in production code

---

#### 6.3 Add Code Comments for Complex Logic
**Priority**: LOW
**Estimated Time**: 4 hours

**Strategy**: Add comments ONLY where logic is not self-evident

**Actions**:
1. Review complex use cases and add comments:
   ```typescript
   // Calculate patient age considering leap years and partial years
   public calculateAge(): number {
     const today = new Date();
     const birthDate = new Date(this.dateOfBirth);
     let age = today.getFullYear() - birthDate.getFullYear();
     const monthDiff = today.getMonth() - birthDate.getMonth();

     // Adjust age if birthday hasn't occurred this year
     if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
       age--;
     }

     return age;
   }
   ```
2. Add comments for non-obvious business rules:
   ```typescript
   // Per Nigerian medical regulation, consent version must be tracked
   // for 7 years for legal compliance (NDPR requirement)
   consentVersion: data.consentGiven ? '1.0' : null,
   ```
3. Document repository mappings:
   ```typescript
   // Maps Prisma Patient schema to domain PatientEntity
   // Note: Database uses 'patientId' field, domain uses 'patientId' property
   private mapToEntity(patient: PrismaPatient): PatientEntity {
   ```

**Files to Update**:
- [ ] Complex use cases
- [ ] Entity methods with business logic
- [ ] Repository mapping methods

**Acceptance Criteria**:
- Complex logic explained
- Business rules documented
- No obvious/redundant comments

---

## Phase 7: Performance & Monitoring (Week 7)

### Objective
Add performance monitoring, optimize slow queries, and implement proper logging.

### Tasks

#### 7.1 Add Prisma Query Logging
**Priority**: LOW
**Estimated Time**: 2 hours

**File**: `src/backend/infrastructure/database/prisma.client.ts`

**Actions**:
1. Enable query logging in development:
   ```typescript
   const prisma = new PrismaClient({
     log: [
       { level: 'query', emit: 'event' },
       { level: 'error', emit: 'stdout' },
       { level: 'warn', emit: 'stdout' },
     ],
   });

   // Log slow queries (> 100ms)
   prisma.$on('query' as any, (e: any) => {
     if (e.duration > 100) {
       logger.warn('Slow query detected', {
         query: e.query,
         duration: e.duration,
         params: e.params
       });
     }
   });
   ```

**Acceptance Criteria**:
- Slow queries logged
- Query logging configurable via env
- Development shows all queries

---

#### 7.2 Add Request Duration Logging
**Priority**: LOW
**Estimated Time**: 2 hours

**File**: Create `src/backend/presentation/middleware/request-logger.middleware.ts`

**Content**:
```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../../config/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    logger.info('HTTP Request', {
      method,
      url: originalUrl,
      statusCode,
      duration,
      ip,
      userAgent: req.get('user-agent')
    });

    // Warn on slow requests (> 1 second)
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        method,
        url: originalUrl,
        duration
      });
    }
  });

  next();
}
```

**Acceptance Criteria**:
- All requests logged with duration
- Slow requests highlighted
- Logs structured for analysis

---

#### 7.3 Add Database Connection Pool Monitoring
**Priority**: LOW
**Estimated Time**: 2 hours

**Actions**:
1. Add connection pool metrics:
   ```typescript
   // In prisma.client.ts
   setInterval(() => {
     prisma.$metrics.prometheus().then(metrics => {
       logger.debug('Database metrics', { metrics });
     });
   }, 60000); // Every minute
   ```

**Acceptance Criteria**:
- Connection pool size monitored
- Alerts on connection exhaustion
- Metrics exposed for monitoring tools

---

## Implementation Schedule

### Week 1: Critical Database Fixes
- Day 1-2: Consolidate Prisma clients (#1.1)
- Day 3: Initialize DB connection (#1.2)
- Day 4-5: Fix duplicate Patient entities (#1.3)

### Week 2: Type Safety & Error Handling
- Day 1-2: Replace `as any` casts (#2.1)
- Day 3-4: Implement AppError (#2.2)
- Day 5: Replace console logs (#2.3)

### Week 3: Validation & Data Consistency
- Day 1-2: Fix validators (#3.1)
- Day 3: Standardize field naming (#3.2)
- Day 4: Add tenant middleware (#3.3)

### Week 4: Complete Features
- Day 1-3: Drug interaction checking (#4.1)
- Day 4: Email service (#4.2)
- Day 5: SMS service (#4.3)

### Week 5: Testing
- Day 1: Setup testing (#5.1)
- Day 2-4: Unit tests (#5.2)
- Day 5: Integration tests start (#5.3)

### Week 6: Documentation
- Day 1-2: Continue integration tests
- Day 3-4: Swagger docs (#6.1)
- Day 5: ESLint/Prettier (#6.2)

### Week 7: Performance & Polish
- Day 1-2: Query optimization (#7.1, #7.2)
- Day 3-4: Code review and fixes
- Day 5: Final testing and deployment prep

---

## Success Metrics

### Technical Metrics
- [ ] Zero `new PrismaClient()` instantiations (except singleton)
- [ ] Zero `as any` type casts
- [ ] Zero `console.error/log` in production code
- [ ] 80%+ test coverage for use cases
- [ ] All API endpoints have integration tests
- [ ] All endpoints documented in Swagger
- [ ] ESLint passes with zero errors
- [ ] TypeScript strict mode enabled

### Functional Metrics
- [ ] Patient search works without errors
- [ ] Patient registration generates correct IDs
- [ ] All CRUD operations functional
- [ ] Drug interactions checked
- [ ] Emails sent successfully
- [ ] SMS sent successfully
- [ ] Multi-tenancy enforced

### Performance Metrics
- [ ] No queries slower than 100ms (log warnings)
- [ ] No requests slower than 1 second (log warnings)
- [ ] Connection pool never exhausted
- [ ] Server startup < 5 seconds

---

## Risk Mitigation

### High Risk Areas
1. **Database Migration**: Test thoroughly in development before production
2. **Type Changes**: May break existing frontend code - coordinate changes
3. **Pharmacy Module**: Decision needed - remove or complete?

### Rollback Plan
1. Keep Git tags at each phase completion
2. Can revert to any previous phase if issues found
3. Database migrations should be reversible

### Testing Strategy
1. Manual testing after each phase
2. Automated tests before moving to next phase
3. Staging environment testing before production

---

## Post-Refactoring Maintenance

### Ongoing Tasks
1. Monitor slow query logs weekly
2. Review error logs daily
3. Update tests when adding features
4. Keep dependencies updated
5. Review and update documentation quarterly

### Code Review Checklist
Before merging any new code:
- [ ] No `as any` casts
- [ ] No console.* calls
- [ ] Uses logger service
- [ ] Has tests
- [ ] Swagger docs updated
- [ ] Error handling with AppError
- [ ] Multi-tenancy checked

---

## Appendix A: File Structure After Refactoring

```
src/backend/
├── domain/
│   ├── entities/
│   │   ├── Patient.entity.ts (SINGLE entity, no duplicates)
│   │   ├── Consultation.entity.ts
│   │   └── ...
│   ├── interfaces/
│   │   ├── IPatientRepository.ts
│   │   └── ...
│   └── services/
│
├── application/
│   ├── dtos/ (all use patientId)
│   ├── use-cases/ (all use AppError)
│   └── validators/ (international phone numbers)
│
├── infrastructure/
│   ├── database/
│   │   ├── prisma.client.ts (SINGLE instance exported)
│   │   └── repositories/ (proper types, no 'any')
│   ├── services/
│   │   ├── email.service.ts (SendGrid implemented)
│   │   ├── sms.service.ts (Twilio implemented)
│   │   └── drug-interaction.service.ts (NEW)
│   └── external/
│
├── presentation/
│   ├── controllers/ (all import singleton prisma)
│   ├── middleware/
│   │   ├── tenant.middleware.ts (NEW)
│   │   └── request-logger.middleware.ts (NEW)
│   └── routes/ (all documented with Swagger)
│
├── shared/
│   ├── errors/
│   │   └── AppError.ts (used everywhere)
│   ├── constants/
│   │   └── error-codes.ts (NEW)
│   └── utils/
│       └── logger.ts (used instead of console)
│
├── config/
│   └── swagger.ts (NEW)
│
├── types/
│   └── express.d.ts (NEW - proper Request typing)
│
├── __tests__/
│   ├── helpers/
│   │   └── test-helpers.ts (NEW)
│   ├── integration/
│   │   ├── patient.integration.spec.ts (NEW)
│   │   └── ...
│   └── unit/
│       └── ... (use case tests)
│
└── server.ts (calls connectDatabase on startup)
```

---

## Appendix B: Environment Variables After Refactoring

```bash
# Database
DATABASE_URL="postgresql://postgres:PASSWORD@db.XXX.supabase.co:6543/postgres"
DIRECT_URL="postgresql://postgres:PASSWORD@db.XXX.supabase.co:5432/postgres"
TEST_DATABASE_URL="postgresql://postgres:PASSWORD@db.XXX.supabase.co:5432/postgres_test"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
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

# Email (SendGrid)
SENDGRID_API_KEY="SG.xxxxxxxxxxxxx"
FROM_EMAIL="noreply@yourdomain.com"

# SMS (Twilio)
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxx"
TWILIO_PHONE_NUMBER="+1234567890"

# Drug Interaction API
DRUG_API_KEY="xxxxxxxxxxxxx"
DRUG_API_URL="https://api.example.com"

# Logging
LOG_LEVEL="info"

# Monitoring
ENABLE_QUERY_LOGGING="true"
SLOW_QUERY_THRESHOLD_MS="100"
```

---

## Conclusion

This refactoring plan addresses all critical issues identified in the audit and provides a clear path to a stable, maintainable codebase. Following the phased approach will minimize risk and ensure that functionality is restored systematically.

**Estimated Total Time**: 7 weeks (1 developer full-time)
**Expected Outcome**: Fully functional EMR system with 80%+ test coverage, proper error handling, and complete documentation.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-26
**Author**: Technical Audit Team
