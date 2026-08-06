/**
 * Update DHIS2 Config Use Case
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from '../../../shared/errors/AppError';
import { UpdateDhis2ConfigDto } from '../../dtos/interoperability/UpdateDhis2Config.dto';
import { encrypt } from '../../../infrastructure/security/encryption.util';

export class UpdateDhis2ConfigUseCase {
  constructor(private prisma: PrismaClient) {}

  async execute(tenantId: string, dto: UpdateDhis2ConfigDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundError('Tenant', tenantId);
    }

    if (dto.dhis2BaseUrl !== undefined && dto.dhis2BaseUrl.trim() !== '') {
      try {
        new URL(dto.dhis2BaseUrl);
      } catch {
        throw new ValidationError('DHIS2 base URL is not a valid URL');
      }
    }

    const updateData: Prisma.TenantUpdateInput = {};

    if (dto.dhis2Enabled !== undefined) updateData.dhis2Enabled = dto.dhis2Enabled;
    if (dto.dhis2BaseUrl !== undefined) updateData.dhis2BaseUrl = dto.dhis2BaseUrl;
    if (dto.dhis2Username !== undefined) updateData.dhis2Username = dto.dhis2Username;
    // Blank/omitted password means "keep the existing one" — never overwrite
    // a real encrypted password with an empty value just because the field
    // was left blank in the form.
    if (dto.dhis2Password !== undefined && dto.dhis2Password.trim() !== '') {
      updateData.dhis2Password = encrypt(dto.dhis2Password);
    }
    if (dto.dhis2OrgUnitId !== undefined) updateData.dhis2OrgUnitId = dto.dhis2OrgUnitId;
    if (dto.dhis2DataElementTotalVisits !== undefined) updateData.dhis2DataElementTotalVisits = dto.dhis2DataElementTotalVisits;
    if (dto.dhis2DataElementPediatricUnder5 !== undefined) updateData.dhis2DataElementPediatricUnder5 = dto.dhis2DataElementPediatricUnder5;
    if (dto.dhis2DataElementSevereMalnutrition !== undefined) updateData.dhis2DataElementSevereMalnutrition = dto.dhis2DataElementSevereMalnutrition;
    if (dto.dhis2DataElementLiveBirths !== undefined) updateData.dhis2DataElementLiveBirths = dto.dhis2DataElementLiveBirths;
    if (dto.dhis2DataElementSeverePostpartumHemorrhage !== undefined) updateData.dhis2DataElementSeverePostpartumHemorrhage = dto.dhis2DataElementSeverePostpartumHemorrhage;
    if (dto.dhis2CategoryOptionCombo !== undefined) updateData.dhis2CategoryOptionCombo = dto.dhis2CategoryOptionCombo;

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
      select: {
        dhis2Enabled: true,
        dhis2BaseUrl: true,
        dhis2Username: true,
        dhis2Password: true,
        dhis2OrgUnitId: true,
        dhis2DataElementTotalVisits: true,
        dhis2DataElementPediatricUnder5: true,
        dhis2DataElementSevereMalnutrition: true,
        dhis2DataElementLiveBirths: true,
        dhis2DataElementSeverePostpartumHemorrhage: true,
        dhis2CategoryOptionCombo: true,
      },
    });

    const { dhis2Password, ...rest } = updated;
    return { ...rest, dhis2PasswordSet: !!dhis2Password };
  }
}
