/**
 * Register User DTO
 * Data transfer object for user registration
 */

export interface RegisterUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  tenantId: string;
}

export interface RegisterUserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string;
  createdAt: Date;
  token: string;
  refreshToken: string;
}
