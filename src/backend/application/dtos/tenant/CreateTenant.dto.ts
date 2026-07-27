/**
 * Create Tenant DTO
 *
 * Data Transfer Object for onboarding a new clinic (tenant) plus its
 * first ADMIN user, in-app — replacing scripts/final-create-admin.js.
 */

export interface CreateTenantDto {
  name: string;
  slug: string;
  clinicName: string;
  address?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  subscriptionTier?: string;

  adminEmail: string;
  adminPassword: string;
  adminFirstName: string;
  adminLastName: string;
  adminPhone?: string;
}

export interface CreateTenantResponseDto {
  tenant: {
    id: string;
    name: string;
    slug: string;
    clinicName: string;
    status: string;
    subscriptionTier: string;
    createdAt: Date;
  };
  admin: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}
