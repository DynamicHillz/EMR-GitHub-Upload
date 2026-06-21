/**
 * Reset Password DTOs
 * Data transfer objects for password reset flow
 */

export interface ForgotPasswordDto {
  email: string;
  tenantId: string;
}

export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}
