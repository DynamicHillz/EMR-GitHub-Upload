/**
 * Login Integration Tests
 *
 * Covers LoginUseCase — the security-critical gate: tenant-suspension
 * check, account lockout after repeated failures, and credential
 * verification.
 */

import { PrismaClient } from '@prisma/client';
import { LoginUseCase } from '../../application/use-cases/auth/login.use-case';
import { createTestPrisma, createTestTenant, createTestUser, cleanDatabase } from '../helpers/test-helpers';

const KNOWN_PASSWORD = 'testpassword123';

describe('Login Integration', () => {
  let prisma: PrismaClient;
  let useCase: LoginUseCase;
  let tenantId: string;

  beforeAll(async () => {
    prisma = createTestPrisma();

    const tenant = await createTestTenant(prisma);
    tenantId = tenant.id;

    useCase = new LoginUseCase(prisma);
  });

  afterAll(async () => {
    await cleanDatabase(prisma, tenantId);
    await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('should log in successfully with correct credentials and issue an access token', async () => {
    const user = await createTestUser(prisma, tenantId, { email: 'login-ok@test.com' });

    const result = await useCase.execute({ email: user.email, password: KNOWN_PASSWORD }, tenantId);

    expect(result.accessToken).toBeDefined();
    expect(result.user.email).toBe(user.email);
    expect(result.refreshToken).toBeUndefined(); // rememberMe not set

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.failedLoginAttempts).toBe(0);
    expect(dbUser?.lastLogin).toBeDefined();
  });

  it('should issue a refresh token when rememberMe is set', async () => {
    const user = await createTestUser(prisma, tenantId, { email: 'login-remember@test.com' });

    const result = await useCase.execute(
      { email: user.email, password: KNOWN_PASSWORD, rememberMe: true },
      tenantId
    );

    expect(result.refreshToken).toBeDefined();

    const dbToken = await prisma.refreshToken.findUnique({ where: { token: result.refreshToken! } });
    expect(dbToken?.userId).toBe(user.id);
  });

  it('should reject an incorrect password, increment failedLoginAttempts, and write a LOGIN_FAILED audit row', async () => {
    const user = await createTestUser(prisma, tenantId, { email: 'login-wrongpw@test.com' });

    await expect(
      useCase.execute({ email: user.email, password: 'wrong-password' }, tenantId, { ipAddress: '10.0.0.1', userAgent: 'jest' })
    ).rejects.toThrow('Invalid email or password');

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.failedLoginAttempts).toBe(1);
    expect(dbUser?.lockedUntil).toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { tenantId, userId: user.id, action: 'LOGIN_FAILED' } });
    expect(audit).not.toBeNull();
    expect(audit?.ipAddress).toBe('10.0.0.1');
    expect(JSON.parse(audit!.metadata!).reason).toBe('invalid_password');
  });

  it('should reject login for a non-existent email without revealing that it does not exist, but still audit the attempt', async () => {
    await expect(
      useCase.execute({ email: 'nobody@test.com', password: 'whatever' }, tenantId)
    ).rejects.toThrow('Invalid email or password');

    const audit = await prisma.auditLog.findFirst({
      where: { tenantId, userId: null, action: 'LOGIN_FAILED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(JSON.parse(audit!.metadata!).reason).toBe('no_such_user');
    expect(JSON.parse(audit!.metadata!).attemptedEmail).toBe('nobody@test.com');
  });

  it('should lock the account after 5 failed attempts, reject even a correct password while locked, and audit both the lockout and the locked-attempt', async () => {
    const user = await createTestUser(prisma, tenantId, { email: 'login-lockout@test.com' });

    for (let i = 0; i < 4; i++) {
      await expect(
        useCase.execute({ email: user.email, password: 'wrong-password' }, tenantId)
      ).rejects.toThrow('Invalid email or password');
    }

    // 5th failure crosses MAX_LOGIN_ATTEMPTS and locks the account
    await expect(
      useCase.execute({ email: user.email, password: 'wrong-password' }, tenantId)
    ).rejects.toThrow('Account locked due to too many failed login attempts');

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(dbUser?.lockedUntil).not.toBeNull();
    expect(dbUser!.lockedUntil!.getTime()).toBeGreaterThan(Date.now());

    const lockedAudit = await prisma.auditLog.findFirst({ where: { tenantId, userId: user.id, action: 'ACCOUNT_LOCKED' } });
    expect(lockedAudit).not.toBeNull();

    // Even the correct password is rejected while locked
    await expect(
      useCase.execute({ email: user.email, password: KNOWN_PASSWORD }, tenantId)
    ).rejects.toThrow('Account is locked until');

    const lockedAttemptAudit = await prisma.auditLog.findFirst({
      where: { tenantId, userId: user.id, action: 'LOGIN_FAILED' },
      orderBy: { timestamp: 'desc' },
    });
    expect(JSON.parse(lockedAttemptAudit!.metadata!).reason).toBe('account_locked');
  });

  it('should reject login for a suspended user account and audit it', async () => {
    const user = await createTestUser(prisma, tenantId, { email: 'login-suspended@test.com', status: 'SUSPENDED' });

    await expect(
      useCase.execute({ email: user.email, password: KNOWN_PASSWORD }, tenantId)
    ).rejects.toThrow('Account is suspended');

    const audit = await prisma.auditLog.findFirst({ where: { tenantId, userId: user.id, action: 'LOGIN_FAILED' } });
    expect(JSON.parse(audit!.metadata!).reason).toBe('account_inactive');
  });

  it('should reject login for every user of a suspended tenant and audit it', async () => {
    const suspendedTenant = await createTestTenant(prisma);
    await prisma.tenant.update({ where: { id: suspendedTenant.id }, data: { status: 'SUSPENDED' } });
    const user = await createTestUser(prisma, suspendedTenant.id, { email: 'tenant-suspended@test.com' });

    await expect(
      useCase.execute({ email: user.email, password: KNOWN_PASSWORD }, suspendedTenant.id)
    ).rejects.toThrow('This clinic account is suspended');

    const audit = await prisma.auditLog.findFirst({ where: { tenantId: suspendedTenant.id, action: 'LOGIN_FAILED' } });
    expect(JSON.parse(audit!.metadata!).reason).toBe('tenant_suspended');

    await cleanDatabase(prisma, suspendedTenant.id);
    await prisma.tenant.delete({ where: { id: suspendedTenant.id } });
  });

  it('should write a USER_LOGIN audit row with ipAddress/userAgent on success', async () => {
    const user = await createTestUser(prisma, tenantId, { email: 'login-audit-ok@test.com' });

    await useCase.execute(
      { email: user.email, password: KNOWN_PASSWORD },
      tenantId,
      { ipAddress: '192.168.1.5', userAgent: 'jest-agent' }
    );

    const audit = await prisma.auditLog.findFirst({ where: { tenantId, userId: user.id, action: 'USER_LOGIN' } });
    expect(audit).not.toBeNull();
    expect(audit?.ipAddress).toBe('192.168.1.5');
    expect(audit?.userAgent).toBe('jest-agent');
  });
});
