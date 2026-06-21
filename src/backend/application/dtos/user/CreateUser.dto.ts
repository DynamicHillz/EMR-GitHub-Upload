/**
 * Create User DTO
 * Data transfer object for creating a new user (admin operation)
 */

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  tenantId: string;
  sendWelcomeEmail?: boolean;
}

export interface UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  status: string;
  tenantId: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
