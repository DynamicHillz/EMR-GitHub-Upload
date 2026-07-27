/**
 * Login User DTO
 * Data transfer object for user login
 */

export interface LoginUserDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginUserResponseDto {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    requirePasswordChange?: boolean;
  };
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}
