# Backend Architecture Documentation

## Clean Architecture / Layered Architecture

This backend follows Clean Architecture principles, organizing code into distinct layers with clear responsibilities and dependencies flowing inward (from outer layers to inner layers).

## Directory Structure

```
src/backend/
├── domain/                    # Domain/Business Logic Layer (Core)
│   ├── entities/             # Domain entities with business logic
│   │   └── Patient.ts        # Patient domain entity
│   ├── interfaces/           # Repository interfaces (contracts)
│   │   └── IPatientRepository.ts
│   └── services/             # Domain services (business rules)
│       └── patient.service.ts
│
├── application/              # Application Layer (Use Cases)
│   ├── dtos/                # Data Transfer Objects
│   │   └── patient.dto.ts
│   ├── use-cases/           # Application use cases
│   │   └── patient/
│   │       └── register-patient.use-case.ts
│   └── validators/          # Input validation schemas
│       └── patient.validator.ts
│
├── infrastructure/          # Infrastructure Layer (External Concerns)
│   ├── database/           # Database implementations
│   │   ├── prisma.client.ts
│   │   └── repositories/
│   │       └── patient.repository.ts
│   ├── external/           # External service integrations
│   │   └── sms.service.ts
│   └── cache/              # Caching implementation
│       └── cache.service.ts
│
├── presentation/            # Presentation Layer (HTTP/API)
│   ├── controllers/        # HTTP request handlers
│   │   └── auth.controller.ts
│   ├── routes/             # Express route definitions
│   │   ├── auth.routes.ts
│   │   ├── patient.routes.ts
│   │   └── ... (other routes)
│   ├── middleware/         # Express middleware
│   │   ├── auth.ts
│   │   └── errorHandler.ts
│   └── validators/         # Request validation middleware
│
├── shared/                  # Shared Utilities (Cross-cutting)
│   ├── utils/              # Utility functions
│   │   ├── date.utils.ts
│   │   └── string.utils.ts
│   ├── constants/          # Application constants
│   │   ├── http-status.ts
│   │   └── error-messages.ts
│   ├── types/              # Shared TypeScript types
│   │   └── common.types.ts
│   └── errors/             # Custom error classes
│       └── AppError.ts
│
├── config/                  # Configuration
│   ├── database.ts         # Database configuration
│   ├── env.ts              # Environment variables
│   └── logger.ts           # Logging configuration
│
└── server.ts               # Application entry point
```

## Layer Responsibilities

### 1. Domain Layer (Core Business Logic)
- **Location**: `domain/`
- **Responsibility**: Contains the core business logic and rules
- **Dependencies**: None (depends on nothing)
- **Key Principles**:
  - Pure business logic, no infrastructure concerns
  - Defines interfaces that outer layers must implement
  - Contains entities with business methods
  - Domain services for complex business operations

**Example**:
```typescript
// domain/entities/Patient.ts
export class PatientEntity {
  get age(): number { /* business logic */ }
  hasAllergy(allergen: string): boolean { /* business logic */ }
}
```

### 2. Application Layer (Use Cases)
- **Location**: `application/`
- **Responsibility**: Orchestrates business logic and coordinates between layers
- **Dependencies**: Domain layer only
- **Key Principles**:
  - Implements application-specific business rules
  - Coordinates domain objects to perform tasks
  - Defines DTOs for data transfer
  - Validates input data

**Example**:
```typescript
// application/use-cases/patient/register-patient.use-case.ts
export class RegisterPatientUseCase {
  async execute(dto: CreatePatientDto, tenantId: string): Promise<PatientResponseDto> {
    // Orchestrate domain services and repositories
  }
}
```

### 3. Infrastructure Layer (External Services)
- **Location**: `infrastructure/`
- **Responsibility**: Implements interfaces defined by domain layer
- **Dependencies**: Domain and Application layers
- **Key Principles**:
  - Database access (Prisma repositories)
  - External API integrations (SMS, Email)
  - Caching implementations
  - File system operations

**Example**:
```typescript
// infrastructure/database/repositories/patient.repository.ts
export class PatientRepository implements IPatientRepository {
  async findById(id: string): Promise<Patient | null> {
    return await this.prisma.patient.findFirst({ where: { id } });
  }
}
```

### 4. Presentation Layer (HTTP/API)
- **Location**: `presentation/`
- **Responsibility**: Handles HTTP requests and responses
- **Dependencies**: Application and Domain layers
- **Key Principles**:
  - Express controllers and routes
  - Request/response transformation
  - Authentication and authorization
  - Error handling middleware

**Example**:
```typescript
// presentation/controllers/patient.controller.ts
export class PatientController {
  async register(req: Request, res: Response) {
    const dto = req.body;
    const result = await this.registerPatientUseCase.execute(dto);
    res.status(201).json(result);
  }
}
```

### 5. Shared Layer (Cross-cutting Concerns)
- **Location**: `shared/`
- **Responsibility**: Utilities used across all layers
- **Dependencies**: None
- **Key Principles**:
  - Reusable utility functions
  - Common types and interfaces
  - Constants and enums
  - Custom error classes

## Dependency Flow

```
Presentation → Application → Domain
     ↓              ↓
Infrastructure ←──────┘
     ↓
  Shared (used by all)
```

**Rules**:
1. Inner layers never depend on outer layers
2. Dependencies always point inward
3. Domain layer has no dependencies
4. Infrastructure implements domain interfaces (Dependency Inversion)

## Benefits of This Architecture

1. **Separation of Concerns**: Each layer has a clear responsibility
2. **Testability**: Easy to unit test business logic without infrastructure
3. **Maintainability**: Changes in one layer don't affect others
4. **Flexibility**: Easy to swap implementations (e.g., change database)
5. **Scalability**: Clear structure for adding new features
6. **Team Collaboration**: Different teams can work on different layers

## Adding New Features

### Example: Adding a new "Appointment" feature

1. **Domain Layer**: Create entity and interface
   ```typescript
   // domain/entities/Appointment.ts
   // domain/interfaces/IAppointmentRepository.ts
   // domain/services/appointment.service.ts
   ```

2. **Application Layer**: Create DTOs and use cases
   ```typescript
   // application/dtos/appointment.dto.ts
   // application/use-cases/appointment/book-appointment.use-case.ts
   // application/validators/appointment.validator.ts
   ```

3. **Infrastructure Layer**: Implement repository
   ```typescript
   // infrastructure/database/repositories/appointment.repository.ts
   ```

4. **Presentation Layer**: Create controller and routes
   ```typescript
   // presentation/controllers/appointment.controller.ts
   // presentation/routes/appointment.routes.ts (already exists)
   ```

## Migration Summary

### Files Moved
- `controllers/auth.controller.ts` → `presentation/controllers/auth.controller.ts`
- `routes/*.ts` → `presentation/routes/*.ts` (10 files)
- `middleware/*.ts` → `presentation/middleware/*.ts` (2 files)
- `utils/logger.ts` → `config/logger.ts`

### New Files Created

**Domain Layer**:
- `domain/entities/Patient.ts`
- `domain/interfaces/IPatientRepository.ts`
- `domain/services/patient.service.ts`

**Application Layer**:
- `application/dtos/patient.dto.ts`
- `application/use-cases/patient/register-patient.use-case.ts`
- `application/validators/patient.validator.ts`

**Infrastructure Layer**:
- `infrastructure/database/prisma.client.ts`
- `infrastructure/database/repositories/patient.repository.ts`
- `infrastructure/external/sms.service.ts`
- `infrastructure/cache/cache.service.ts`

**Shared Layer**:
- `shared/errors/AppError.ts`
- `shared/types/common.types.ts`
- `shared/utils/date.utils.ts`
- `shared/utils/string.utils.ts`
- `shared/constants/http-status.ts`
- `shared/constants/error-messages.ts`

**Config**:
- `config/database.ts`
- `config/env.ts`

### Imports Updated
- `server.ts`: Updated all route and middleware imports
- `presentation/middleware/errorHandler.ts`: Updated logger import
- `presentation/middleware/auth.ts`: Updated logger import
- All routes already use relative imports (no changes needed)

## Next Steps

1. Implement remaining controllers using the new architecture
2. Create use cases for existing routes
3. Add unit tests for domain services
4. Add integration tests for use cases
5. Implement dependency injection container (optional)
6. Add API documentation (Swagger/OpenAPI)

## Best Practices

1. **Keep domain layer pure**: No database, HTTP, or external service code
2. **Use DTOs**: Always transform between layers using DTOs
3. **Interface segregation**: Define small, focused interfaces
4. **Dependency injection**: Pass dependencies through constructors
5. **Error handling**: Use custom error classes from shared layer
6. **Validation**: Validate at presentation layer before reaching use cases
7. **Logging**: Use structured logging from config/logger.ts
8. **Environment variables**: Access through config/env.ts only

## Resources

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
