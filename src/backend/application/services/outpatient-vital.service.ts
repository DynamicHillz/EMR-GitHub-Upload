// @ts-ignore - Temporary fix for schema alignment
import { PrismaClient, OutpatientVital } from '@prisma/client';
import { logger } from '../../config/logger';

const prisma = new PrismaClient();

export class OutpatientVitalService {
  /**
   * Create a new vital record
   */
  async recordVitals(
    tenantId: string,
    patientId: string,
    recordedById: string,
    data: any
  ): Promise<OutpatientVital> {
    try {
      const {
        appointmentId,
        consultationId,
        bloodPressure,
        heartRate,
        respiratoryRate,
        temperature,
        weight,
        height,
        headCircumference,
        muac,
        spO2,
        notes
      } = data;

      // Calculate BMI if weight and height are provided
      let bmi = undefined;
      if (weight && height) {
        const heightInMeters = height / 100;
        bmi = Number((weight / (heightInMeters * heightInMeters)).toFixed(2));
      }

      // @ts-ignore - Temporary fix for schema alignment
      const vital = await prisma.outpatientVital.create({
        data: {
          tenantId,
          patientId,
          recordedById,
          appointmentId,
          consultationId,
          systolicBP: bloodPressure ? parseInt(bloodPressure.split("/")[0]) : null,
          diastolicBP: bloodPressure ? parseInt(bloodPressure.split("/")[1]) : null,
          heartRate: heartRate ? parseInt(heartRate) : null,
          respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : null,
          temperature: temperature ? parseFloat(temperature) : null,
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseFloat(height) : null,
          headCircumference: headCircumference ? parseFloat(headCircumference) : null,
          muac: muac ? parseFloat(muac) : null,
          spO2: spO2 ? parseInt(spO2) : null,
          bmi,
          notes
        },
        include: {
          recordedBy: {
            select: { id: true, firstName: true, lastName: true, role: true }
          }
        }
      });

      return vital;
    } catch (error) {
      logger.error('Error recording outpatient vitals:', error);
      throw error;
    }
  }

  /**
   * Get vitals for a specific patient
   */
  async getPatientVitals(tenantId: string, patientId: string): Promise<OutpatientVital[]> {
    try {
      // @ts-ignore - Temporary fix for schema alignment
      return await prisma.outpatientVital.findMany({
        where: {
          tenantId,
          patientId
        },
        orderBy: {
          recordedAt: 'desc'
        },
        include: {
          recordedBy: {
            select: { id: true, firstName: true, lastName: true, role: true }
          },
          appointment: {
            select: { id: true, appointmentDate: true, appointmentTime: true }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching patient vitals:', error);
      throw error;
    }
  }

  /**
   * Get latest vitals for a patient today (useful for doctors starting a consultation)
   */
  async getLatestVitalsToday(tenantId: string, patientId: string): Promise<OutpatientVital | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // @ts-ignore - Temporary fix for schema alignment
      return await prisma.outpatientVital.findFirst({
        where: {
          tenantId,
          patientId,
          recordedAt: {
            gte: today
          }
        },
        orderBy: {
          recordedAt: 'desc'
        },
        include: {
          recordedBy: {
            select: { id: true, firstName: true, lastName: true, role: true }
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching latest vitals today:', error);
      throw error;
    }
  }
}
