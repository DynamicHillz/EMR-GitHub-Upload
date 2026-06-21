/**
 * Change Password DTO
 * Data transfer object for password change
 */

export interface ChangePasswordDto {
  userId: string;
  oldPassword: string;
  newPassword: string;
}
