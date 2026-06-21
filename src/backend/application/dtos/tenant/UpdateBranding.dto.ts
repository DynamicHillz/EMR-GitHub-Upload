/**
 * Update Tenant Branding DTO
 *
 * Data Transfer Object for updating clinic branding and customization
 */

export interface UpdateBrandingDto {
  clinicName?: string;
  address?: string | null;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}
