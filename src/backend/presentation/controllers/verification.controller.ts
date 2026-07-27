import { Request, Response } from 'express';
import { verificationService } from '../../application/services/verification.service';
import { prisma } from '../../infrastructure/database/prisma.client';
import { logger } from '../../config/logger';
import { getSafeErrorMessage } from '../../shared/utils/error-message.util';

/**
 * POST /api/verification/verify
 * Public endpoint to verify a document (Invoice or Patient Record) via QR code token
 */
export const verifyDocument = async (req: Request, res: Response) => {
  try {
    const { token, pin } = req.body;

    if (!token || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Token and PIN are required',
      });
    }

    // 1. Decode and verify token signature
    let payload;
    try {
      payload = verificationService.verifyToken(token);
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: getSafeErrorMessage(error, 'Invalid or expired verification token'),
      });
    }

    // 2. Fetch document based on type
    if (payload.type === 'INVOICE') {
      const invoice = await prisma.invoice.findUnique({
        where: { id: payload.id },
        include: {
          patient: true,
          tenant: true,
          items: true,
        },
      });

      if (!invoice) {
        return res.status(404).json({
          success: false,
          message: 'Invoice not found',
        });
      }

      // 3. Verify PIN (Date of Birth YYYY-MM-DD)
      const patientDob = new Date(invoice.patient.dateOfBirth).toISOString().split('T')[0];
      if (pin !== patientDob) {
        return res.status(401).json({
          success: false,
          message: 'Invalid PIN. Access denied.',
        });
      }

      // 4. Return Canonical Data
      return res.status(200).json({
        success: true,
        message: 'Invoice verified successfully',
        data: {
          type: 'INVOICE',
          clinicName: invoice.tenant.clinicName,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: invoice.invoiceDate,
          patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
          totalAmount: invoice.totalAmount,
          paidAmount: invoice.paidAmount,
          balance: invoice.balance,
          status: invoice.status,
          lineItems: invoice.items,
        },
      });

    } else if (payload.type === 'PATIENT') {
      const patient = await prisma.patient.findUnique({
        where: { id: payload.id },
        include: {
          tenant: true,
        },
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient record not found',
        });
      }

      // 3. Verify PIN (Date of Birth YYYY-MM-DD)
      const patientDob = new Date(patient.dateOfBirth).toISOString().split('T')[0];
      if (pin !== patientDob) {
        return res.status(401).json({
          success: false,
          message: 'Invalid PIN. Access denied.',
        });
      }

      // 4. Return Canonical Data
      return res.status(200).json({
        success: true,
        message: 'Patient record verified successfully',
        data: {
          type: 'PATIENT',
          clinicName: patient.tenant.clinicName,
          patientId: patient.patientId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          gender: patient.gender,
          bloodGroup: patient.bloodGroup,
          genotype: patient.genotype,
          allergies: patient.allergies,
          chronicConditions: patient.chronicConditions,
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: 'Unknown document type',
    });

  } catch (error: any) {
    logger.error('Error verifying document:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify document',
    });
  }
};
