import { GetDhis2ConfigUseCase } from './get-dhis2-config.use-case';

describe('GetDhis2ConfigUseCase', () => {
  let useCase: GetDhis2ConfigUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';

  beforeEach(() => {
    mockPrisma = { tenant: { findUnique: jest.fn() } };
    useCase = new GetDhis2ConfigUseCase(mockPrisma);
  });

  it('never returns the raw password, only whether one is set', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      dhis2Enabled: true,
      dhis2BaseUrl: 'https://play.dhis2.org/dev',
      dhis2Username: 'admin',
      dhis2Password: 'encrypted:secret',
      dhis2OrgUnitId: 'ORG-UNIT-UID',
      dhis2DataElementTotalVisits: 'DE-TOTAL',
      dhis2DataElementPediatricUnder5: 'DE-PED',
      dhis2DataElementSevereMalnutrition: 'DE-SAM',
      dhis2CategoryOptionCombo: 'COC-DEFAULT',
    });

    const result = await useCase.execute(tenantId);

    expect(result).not.toHaveProperty('dhis2Password');
    expect(result.dhis2PasswordSet).toBe(true);
    expect(result.dhis2BaseUrl).toBe('https://play.dhis2.org/dev');
  });

  it('reports dhis2PasswordSet as false when no password is stored', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue({
      dhis2Enabled: false,
      dhis2BaseUrl: null,
      dhis2Username: null,
      dhis2Password: null,
      dhis2OrgUnitId: null,
      dhis2DataElementTotalVisits: null,
      dhis2DataElementPediatricUnder5: null,
      dhis2DataElementSevereMalnutrition: null,
      dhis2CategoryOptionCombo: null,
    });

    const result = await useCase.execute(tenantId);

    expect(result.dhis2PasswordSet).toBe(false);
  });

  it('throws NotFoundError when the tenant does not exist', async () => {
    mockPrisma.tenant.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(tenantId)).rejects.toThrow();
  });
});
