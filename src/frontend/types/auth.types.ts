/**
 * Authentication & User Management Types
 */

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  tenantId: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export type UserRole =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'LAB_TECH'
  | 'PHARMACIST'
  | 'CASHIER'
  | 'RECEPTIONIST';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

// Login
export interface LoginDto {
  email: string;
  password: string;
  tenantId?: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  message: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  };
  token: string;
  refreshToken?: string;
}

// Forgot Password
export interface ForgotPasswordDto {
  email: string;
  tenantId: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

// Reset Password
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  message: string;
}

// Change Password
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// Create User
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

// Update User
export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  status?: string;
}

// User Filters
export interface UserFilters {
  role?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// List Users Response
export interface ListUsersResponse {
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

// Suspend User
export interface SuspendUserDto {
  until?: string; // ISO date string
}

// API Response wrapper
export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: string[];
}
