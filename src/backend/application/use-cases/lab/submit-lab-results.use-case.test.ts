/**
 * Submit Lab Results Use Case Tests
 *
 * Unit-test companion to the integration coverage in
 * src/backend/__tests__/integration/submit-lab-results.integration.test.ts.
 * Reference ranges always come from the server-side lab dictionary
 * (LabParameter.refRangeMale/refRangeFemale, gender-selected), never from
 * client-supplied referenceMin/Max — a missed critical flag here is a real
 * patient-safety incident, so every distinct flagging/notification branch
 * gets its own test.
 */

import { SubmitLabResultsUseCase } from './submit-lab-results.use-case';

describe('SubmitLabResultsUseCase', () => {
  let useCase: SubmitLabResultsUseCase;
  let mockPrisma: any;

  const tenantId = 'tenant-1';
  const recordId = 'record-1';
  const orderId = 'order-1';
  const patientId = 'patient-1';
  const doctorId = 'doctor-1';

  function buildParameter(overrides: any = {}) {
    return {
      id: 'param-1',
      name: 'Glucose',
      unit: 'mg/dL',
      refRangeMale: '70-100',
      refRangeFemale: '70-100',
      deltaCheckPercentage: null,
      ...overrides,
    };
  }

  function buildRecord(overrides: any = {}) {
    const { parameter, test, order, ...rest } = overrides;
    const resolvedParameter = parameter ?? buildParameter();

    return {
      id: recordId,
      orderId,
      status: 'IN_PROGRESS',
      createdAt: new Date('2026-07-27T09:00:00.000Z'),
      test: test ?? { name: 'Fasting Blood Sugar', parameters: [{ parameter: resolvedParameter }] },
      order:
        order ?? {
          patientId,
          orderedById: doctorId,
          patient: { firstName: 'Jane', lastName: 'Doe', gender: 'MALE' },
        },
      ...rest,
    };
  }

  beforeEach(() => {
    mockPrisma = {
      labTestRecord: {
        findFirst: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      labResultValue: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      notification: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    useCase = new SubmitLabResultsUseCase(mockPrisma);
  });

  describe('validation', () => {
    it('should throw when the lab test record does not exist in this tenant', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(null);

      await expect(useCase.execute(recordId, { results: [] }, tenantId)).rejects.toThrow(
        'Lab test not found'
      );
    });

    it('should throw when the test is not IN_PROGRESS', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ status: 'PENDING' }));

      await expect(useCase.execute(recordId, { results: [] }, tenantId)).rejects.toThrow(
        'Can only submit results for tests that are IN_PROGRESS'
      );
      expect(mockPrisma.labResultValue.upsert).not.toHaveBeenCalled();
    });
  });

  describe('numeric range flagging', () => {
    it('should flag a value 20%+ above the reference max as CRITICAL_HIGH and mark isCritical', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(recordId, { results: [{ parameter: 'Glucose', value: '130', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            numericValue: 130,
            textValue: null,
            isAbnormal: true,
            isCritical: true,
            flagType: 'CRITICAL_HIGH',
          }),
        })
      );
    });

    it('should flag a value above max but under the critical threshold as HIGH (not critical)', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(recordId, { results: [{ parameter: 'Glucose', value: '110', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isAbnormal: true, isCritical: false, flagType: 'HIGH' }),
        })
      );
    });

    it('should flag a value 20%+ below the reference min as CRITICAL_LOW', async () => {
      const parameter = buildParameter({ name: 'Potassium', refRangeMale: '3.5-5.0' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Potassium', value: '2.5', unit: 'mmol/L' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCritical: true, flagType: 'CRITICAL_LOW' }),
        })
      );
    });

    it('should flag a value below min but above the critical threshold as LOW (not critical)', async () => {
      const parameter = buildParameter({ name: 'Potassium', refRangeMale: '3.5-5.0' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Potassium', value: '3.0', unit: 'mmol/L' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isCritical: false, flagType: 'LOW' }),
        })
      );
    });

    it('should treat a value within range as normal (no flag)', async () => {
      const parameter = buildParameter({ name: 'Sodium', refRangeMale: '135-145' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Sodium', value: '140', unit: 'mmol/L' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isAbnormal: false, isCritical: false, flagType: null }),
        })
      );
    });

    it('should flag an unparseable value against a ranged parameter as INVALID_VALUE', async () => {
      const parameter = buildParameter({ name: 'Creatinine', refRangeMale: '0.6-1.3' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Creatinine', value: 'N/A', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            numericValue: null,
            isAbnormal: true,
            isCritical: false,
            flagType: 'INVALID_VALUE',
          }),
        })
      );
    });
  });

  describe('qualitative range flagging', () => {
    it('should flag a value outside the allowed qualitative set as ABNORMAL', async () => {
      const parameter = buildParameter({ name: 'Urine Protein', refRangeMale: 'Negative', unit: '' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Urine Protein', value: 'Positive', unit: '' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isAbnormal: true, flagType: 'ABNORMAL' }),
        })
      );
    });

    it('should treat a matching qualitative value (case/whitespace-insensitive) as normal', async () => {
      const parameter = buildParameter({ name: 'Urine Protein', refRangeMale: 'Negative', unit: '' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Urine Protein', value: ' negative ', unit: '' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ isAbnormal: false, flagType: null }),
        })
      );
    });
  });

  describe('value storage (numeric vs text vs json)', () => {
    it('should store numericValue and null textValue for a numeric result', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(recordId, { results: [{ parameter: 'Glucose', value: '95', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ numericValue: 95, textValue: null }),
        })
      );
    });

    it('should store textValue and null numericValue for a non-numeric result with no jsonValue', async () => {
      const parameter = buildParameter({ name: 'Urine Protein', refRangeMale: 'Negative', unit: '' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Urine Protein', value: 'Negative', unit: '' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ numericValue: null, textValue: 'Negative' }),
        })
      );
    });

    it('should store jsonValue and leave textValue null when jsonValue is provided on a non-numeric result', async () => {
      const parameter = buildParameter({ name: 'Culture', refRangeMale: null, unit: '' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));
      const jsonValue = { organism: 'E. coli', sensitivity: 'Ampicillin' };

      await useCase.execute(
        recordId,
        { results: [{ parameter: 'Culture', value: 'see json', unit: '', jsonValue }] },
        tenantId
      );

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ textValue: null, jsonValue }),
        })
      );
    });

    it('should silently skip a result whose parameter name does not match any test parameter', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(
        recordId,
        { results: [{ parameter: 'Unknown Param', value: '10', unit: '' }] },
        tenantId
      );

      expect(mockPrisma.labResultValue.upsert).not.toHaveBeenCalled();
    });
  });

  describe('delta check', () => {
    it('should raise a delta alert when the change from the prior result meets the configured threshold', async () => {
      const parameter = buildParameter({ name: 'Hemoglobin', deltaCheckPercentage: 20, refRangeMale: null });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));
      mockPrisma.labResultValue.findFirst.mockResolvedValue({
        numericValue: 14,
        enteredAt: new Date('2026-07-20T09:00:00.000Z'),
      });

      await useCase.execute(recordId, { results: [{ parameter: 'Hemoglobin', value: '10', unit: 'g/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            hasDeltaAlert: true,
            deltaAlertNotes: expect.stringContaining('Delta Check'),
          }),
        })
      );
    });

    it('should not raise a delta alert when the change is under the configured threshold', async () => {
      const parameter = buildParameter({ name: 'Hemoglobin', deltaCheckPercentage: 20, refRangeMale: null });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));
      mockPrisma.labResultValue.findFirst.mockResolvedValue({
        numericValue: 14,
        enteredAt: new Date('2026-07-20T09:00:00.000Z'),
      });

      await useCase.execute(recordId, { results: [{ parameter: 'Hemoglobin', value: '13.5', unit: 'g/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ hasDeltaAlert: false, deltaAlertNotes: null }),
        })
      );
    });

    it('should skip the delta check entirely when the parameter has no deltaCheckPercentage configured', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(recordId, { results: [{ parameter: 'Glucose', value: '95', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ hasDeltaAlert: false, deltaAlertNotes: null }) })
      );
    });

    it('should not raise a delta alert when there is no prior result', async () => {
      const parameter = buildParameter({ name: 'Hemoglobin', deltaCheckPercentage: 20, refRangeMale: null });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));
      mockPrisma.labResultValue.findFirst.mockResolvedValue(null);

      await useCase.execute(recordId, { results: [{ parameter: 'Hemoglobin', value: '10', unit: 'g/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ hasDeltaAlert: false }) })
      );
    });

    it('should not raise a delta alert when the prior result has no numericValue', async () => {
      const parameter = buildParameter({ name: 'Hemoglobin', deltaCheckPercentage: 20, refRangeMale: null });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));
      mockPrisma.labResultValue.findFirst.mockResolvedValue({ numericValue: null, enteredAt: new Date() });

      await useCase.execute(recordId, { results: [{ parameter: 'Hemoglobin', value: '10', unit: 'g/dL' }] }, tenantId);

      expect(mockPrisma.labResultValue.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ hasDeltaAlert: false }) })
      );
    });
  });

  describe('notification and final status', () => {
    it('should notify the ordering doctor with CRITICAL_LAB_RESULT when any result is critical', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(recordId, { results: [{ parameter: 'Glucose', value: '130', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          userId: doctorId,
          type: 'CRITICAL_LAB_RESULT',
          entityType: 'LabOrder',
          entityId: orderId,
        }),
      });
    });

    it('should notify the ordering doctor with LAB_RESULT_READY when no result is critical', async () => {
      const parameter = buildParameter({ name: 'Sodium', refRangeMale: '135-145' });
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord({ parameter }));

      await useCase.execute(recordId, { results: [{ parameter: 'Sodium', value: '140', unit: 'mmol/L' }] }, tenantId);

      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ type: 'LAB_RESULT_READY', userId: doctorId, entityId: orderId }),
      });
    });

    it('should skip notification entirely when the order has no orderedById', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(
        buildRecord({ order: { patientId, orderedById: null, patient: { firstName: 'Jane', lastName: 'Doe', gender: 'MALE' } } })
      );

      await useCase.execute(recordId, { results: [{ parameter: 'Glucose', value: '130', unit: 'mg/dL' }] }, tenantId);

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
    });

    it('should mark the test COMPLETED and persist resultNotes regardless of flagging outcome', async () => {
      mockPrisma.labTestRecord.findFirst.mockResolvedValue(buildRecord());

      await useCase.execute(
        recordId,
        { results: [{ parameter: 'Glucose', value: '95', unit: 'mg/dL' }], resultNotes: 'all clear' },
        tenantId
      );

      expect(mockPrisma.labTestRecord.update).toHaveBeenCalledWith({
        where: { id: recordId },
        data: { reviewNotes: 'all clear', status: 'COMPLETED' },
      });
    });
  });
});
