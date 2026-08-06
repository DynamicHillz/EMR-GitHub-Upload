import { UpdateDhis2ConfigUseCase } from './update-dhis2-config.use-case';

jest.mock('../../../infrastructure/security/encryption.util', () => ({
  encrypt: jest.fn((value: string) => `encrypted:${value}`),
}));

describe('UpdateDhis2ConfigUseCase', () => {
  let useCase: UpdateDhis2ConfigUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue({ id: tenantId }),
        update: jest.fn().mockResolvedValue({
          dhis2Enabled: true,
          dhis2BaseUrl: 'https://play.dhis2.org/dev',
          dhis2Username: 'admin',
          dhis2Password: 'encrypted:secret',
          dhis2OrgUnitId: 'ORG-UNIT-UID',
          dhis2DataElementTotalVisits: 'DE-TOTAL',
          dhis2DataElementPediatricUnder5: 'DE-PED',
          dhis2DataElementSevereMalnutrition: 'DE-SAM',
          dhis2CategoryOptionCombo: 'COC-DEFAULT',
        }),
      },
    };
    useCase = new UpdateDhis2ConfigUseCase(mockPrisma);
  });

  it('encrypts a non-blank password before storing it', async () => {
    await useCase.execute(tenantId, { dhis2Password: 'secret' });

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dhis2Password: 'encrypted:secret' }) })
    );
  });

  it('does not touch dhis2Password when the field is blank (keeps the existing one)', async () => {
    await useCase.execute(tenantId, { dhis2Password: '', dhis2Enabled: true });

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ dhis2Password: expect.anything() }) })
    );
  });

  it('does not touch dhis2Password when the field is omitted entirely', async () => {
    await useCase.execute(tenantId, { dhis2OrgUnitId: 'NEW-ORG-UNIT' });

    expect(mockPrisma.tenant.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dhis2OrgUnitId: 'NEW-ORG-UNIT' } })
    );
  });

  it('never returns the raw password, only dhis2PasswordSet', async () => {
    const result = await useCase.execute(tenantId, { dhis2Password: 'secret' });

    expect(result).not.toHaveProperty('dhis2Password');
    expect(result.dhis2PasswordSet).toBe(true);
  });

  it('rejects an invalid base URL', async () => {
    await expect(useCase.execute(tenantId, { dhis2BaseUrl: 'not-a-url' })).rejects.toThrow('not a valid URL');
    expect(mockPrisma.tenant.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId, { dhis2Enabled: true })).rejects.toThrow();
  });
});
