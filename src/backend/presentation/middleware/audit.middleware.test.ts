/**
 * Audit Middleware Tests — extractIdFromResponse
 *
 * The generic auditRequest middleware extracts entityId from the URL path,
 * which works for PUT/PATCH/DELETE but not POST (a create has no id in its
 * URL — the new record's id only exists in the response body). This is the
 * fallback that recovers it from the two response shapes actually used
 * across controllers in this codebase.
 */

import { extractIdFromResponse, resolveEntityType, resolveEntity } from './audit.middleware';

describe('extractIdFromResponse', () => {
  it('extracts id from a { data: { id } } wrapper (the common controller shape)', () => {
    expect(extractIdFromResponse({ success: true, data: { id: 'patient-123', firstName: 'Jane' } })).toBe('patient-123');
  });

  it('extracts id from a bare { id } object', () => {
    expect(extractIdFromResponse({ id: 'appointment-456', status: 'BOOKED' })).toBe('appointment-456');
  });

  it('prefers a top-level id over a nested data.id when both exist', () => {
    expect(extractIdFromResponse({ id: 'top-level', data: { id: 'nested' } })).toBe('top-level');
  });

  it('returns undefined when neither shape has an id', () => {
    expect(extractIdFromResponse({ success: true, message: 'Done' })).toBeUndefined();
  });

  it('returns undefined when data is a nested non-object (e.g. a payment response wrapping { payment, invoice })', () => {
    expect(extractIdFromResponse({ data: { payment: { id: 'payment-1' }, invoice: { id: 'invoice-1' } } })).toBeUndefined();
  });

  it('returns undefined for null, undefined, or non-object input', () => {
    expect(extractIdFromResponse(null)).toBeUndefined();
    expect(extractIdFromResponse(undefined)).toBeUndefined();
    expect(extractIdFromResponse('a string')).toBeUndefined();
    expect(extractIdFromResponse(42)).toBeUndefined();
  });

  it('ignores a non-string id field', () => {
    expect(extractIdFromResponse({ id: 12345 })).toBeUndefined();
  });
});

describe('resolveEntity', () => {
  const invoiceId = 'e907fb3d-bc3a-4f9a-aac3-97658aa9ee86';

  it('prefers an id found in the path over anything in the query string, with no type override', () => {
    expect(
      resolveEntity(['api', 'billing', 'invoices', invoiceId], { other: 'x' }, {})
    ).toEqual({ entityId: invoiceId });
  });

  it('recovers the id from a NAMED query param (e.g. ?invoiceId=...) and overrides entityType to match it', () => {
    // Reproduces GET /api/billing/payments?invoiceId=<uuid> — a real bug
    // caught by testing this live: the path resolves entityType to PAYMENT,
    // but the id in the query string is an INVOICE id (this route means
    // "show this invoice's payment history", not "view one payment"). Without
    // the override, the PAYMENT resolver looked up the wrong table entirely
    // and could never find a name for it, always falling back to the raw
    // UUID no matter what the entity-name resolvers did.
    expect(resolveEntity(['api', 'billing', 'payments'], { invoiceId }, {})).toEqual({
      entityId: invoiceId,
      entityTypeOverride: 'INVOICE',
    });
  });

  it('falls back to any id-shaped query value with no type override when the key is not a recognized name', () => {
    expect(resolveEntity(['api', 'billing', 'payments'], { ref: invoiceId }, {})).toEqual({
      entityId: invoiceId,
    });
  });

  it('falls back to req.body.id when neither the path nor the query has one', () => {
    expect(resolveEntity(['api', 'patients'], {}, { id: invoiceId })).toEqual({ entityId: invoiceId });
  });

  it('returns no entityId for a genuine list view with nothing anywhere (not a bug — e.g. GET /api/billing/invoices)', () => {
    expect(resolveEntity(['api', 'billing', 'invoices'], {}, {})).toEqual({});
  });

  it('ignores non-id-shaped query values', () => {
    expect(resolveEntity(['api', 'billing', 'invoices'], { status: 'PAID' }, {})).toEqual({});
  });
});

describe('resolveEntityType', () => {
  const parts = (path: string) => path.split('/').filter((p) => p);

  it('distinguishes invoices, payments, and refunds nested under the shared /api/billing prefix', () => {
    expect(resolveEntityType(parts('/api/billing/invoices/123'))).toBe('INVOICE');
    expect(resolveEntityType(parts('/api/billing/invoices/generate'))).toBe('INVOICE');
    expect(resolveEntityType(parts('/api/billing/payments'))).toBe('PAYMENT');
    expect(resolveEntityType(parts('/api/billing/gateway-payments/initiate'))).toBe('PAYMENT');
    expect(resolveEntityType(parts('/api/billing/refunds/abc/approve'))).toBe('REFUND');
    expect(resolveEntityType(parts('/api/billing/services'))).toBe('SERVICE_CATALOG');
  });

  it('falls back to the generic BILLING type for a billing sub-route with no specific mapping', () => {
    expect(resolveEntityType(parts('/api/billing/outstanding'))).toBe('BILLING');
  });

  it('distinguishes wards, beds, and admissions nested under the shared /api/inpatients prefix', () => {
    expect(resolveEntityType(parts('/api/inpatients/wards/1'))).toBe('WARD');
    expect(resolveEntityType(parts('/api/inpatients/beds/1'))).toBe('WARD');
    expect(resolveEntityType(parts('/api/inpatients/admissions/1/vitals'))).toBe('INPATIENT');
  });

  it('distinguishes medications nested under the shared /api/pharmacy prefix', () => {
    expect(resolveEntityType(parts('/api/pharmacy/medications/1'))).toBe('MEDICATION');
    expect(resolveEntityType(parts('/api/pharmacy/dispense'))).toBe('MEDICATION');
    // Other pharmacy sub-resources (batches, consumables, inventory) fall
    // back to the generic PHARMACY type — no dropdown option promises
    // anything more granular for those today.
    expect(resolveEntityType(parts('/api/pharmacy/batches'))).toBe('PHARMACY');
  });

  it('resolves a plain top-level resource with no nesting exactly as before', () => {
    expect(resolveEntityType(parts('/api/patients/123'))).toBe('PATIENT');
    expect(resolveEntityType(parts('/api/users'))).toBe('USER');
  });

  it('distinguishes providers, patient policies, and claims nested under the shared /api/insurance prefix', () => {
    expect(resolveEntityType(parts('/api/insurance/providers'))).toBe('INSURANCE_PROVIDER');
    expect(resolveEntityType(parts('/api/insurance/patients/patient-1'))).toBe('PATIENT_INSURANCE');
    expect(resolveEntityType(parts('/api/insurance/claims/claim-1'))).toBe('INSURANCE_CLAIM');
  });

  it('resolves every previously-unmapped route group instead of falling to SYSTEM', () => {
    expect(resolveEntityType(parts('/api/exemptions'))).toBe('EXEMPTION_POLICY');
    expect(resolveEntityType(parts('/api/anc/active'))).toBe('ANC');
    expect(resolveEntityType(parts('/api/immunization/schedule'))).toBe('IMMUNIZATION');
    expect(resolveEntityType(parts('/api/tenants'))).toBe('TENANT');
    expect(resolveEntityType(parts('/api/fraud-prevention'))).toBe('FRAUD_PREVENTION_SETTINGS');
    expect(resolveEntityType(parts('/api/notifications'))).toBe('NOTIFICATION');
    expect(resolveEntityType(parts('/api/sync/push'))).toBe('SYNC');
    expect(resolveEntityType(parts('/api/triage/queue'))).toBe('TRIAGE');
    expect(resolveEntityType(parts('/api/labor/worklist'))).toBe('LABOR');
    expect(resolveEntityType(parts('/api/verification/verify'))).toBe('VERIFICATION');
    expect(resolveEntityType(parts('/api/interoperability/fhir/metadata'))).toBe('INTEROPERABILITY');
    expect(resolveEntityType(parts('/api/reports/revenue'))).toBe('REPORT');
    expect(resolveEntityType(parts('/api/dashboard/stats'))).toBe('DASHBOARD');
  });

  it('falls back to SYSTEM only for a genuinely unmapped resource', () => {
    expect(resolveEntityType(parts('/api/branding'))).toBe('SYSTEM');
  });
});
