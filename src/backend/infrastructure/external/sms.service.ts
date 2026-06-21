/**
 * SMS Service
 *
 * External service for sending SMS notifications.
 * This is a placeholder implementation that can be replaced with actual SMS provider.
 */

import { logger } from '../../config/logger';

export interface SendSmsParams {
  to: string;
  message: string;
  tenantId: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SmsService {
  private provider: string;

  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'mock';
  }

  /**
   * Send SMS message
   */
  async sendSms(params: SendSmsParams): Promise<SmsResult> {
    try {
      logger.info(`Sending SMS to ${params.to}`, {
        tenantId: params.tenantId,
        messageLength: params.message.length,
      });

      // TODO: Implement actual SMS provider integration
      // For now, just log the message
      if (this.provider === 'mock') {
        return this.mockSend(params);
      }

      // Add real provider implementations here
      // Example: Twilio, Africa's Talking, etc.

      throw new Error(`SMS provider ${this.provider} not implemented`);
    } catch (error) {
      logger.error('Failed to send SMS:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send appointment reminder SMS
   */
  async sendAppointmentReminder(
    phone: string,
    patientName: string,
    appointmentDate: Date,
    tenantId: string
  ): Promise<SmsResult> {
    const message = `Hi ${patientName}, this is a reminder about your appointment on ${appointmentDate.toLocaleDateString()}. Please arrive 10 minutes early.`;

    return this.sendSms({
      to: phone,
      message,
      tenantId,
    });
  }

  /**
   * Mock SMS sending for development
   */
  private async mockSend(params: SendSmsParams): Promise<SmsResult> {
    logger.info(`[MOCK SMS] To: ${params.to}, Message: ${params.message}`);

    return {
      success: true,
      messageId: `mock-${Date.now()}`,
    };
  }
}
