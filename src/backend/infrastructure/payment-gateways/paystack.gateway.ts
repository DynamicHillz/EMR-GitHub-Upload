/**
 * Paystack Payment Gateway Implementation
 *
 * Implements the IPaymentGateway interface for Paystack
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import {
  IPaymentGateway,
  PaymentGatewayConfig,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
  WebhookEvent,
} from './payment-gateway.interface';

export class PaystackGateway implements IPaymentGateway {
  readonly name = 'PAYSTACK';
  private client: AxiosInstance;
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;

    this.client = axios.create({
      baseURL: 'https://api.paystack.co',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async initiatePayment(
    request: InitiatePaymentRequest
  ): Promise<InitiatePaymentResponse> {
    try {
      const response = await this.client.post('/transaction/initialize', {
        reference: request.reference,
        amount: Math.round(request.amount * 100), // Paystack uses kobo (smallest currency unit)
        currency: request.currency,
        email: request.customerEmail,
        callback_url: request.callbackUrl || request.redirectUrl,
        metadata: {
          ...request.metadata,
          custom_fields: [
            {
              display_name: 'Customer Name',
              variable_name: 'customer_name',
              value: request.customerName,
            },
            {
              display_name: 'Phone',
              variable_name: 'phone',
              value: request.customerPhone || 'N/A',
            },
          ],
        },
      });

      if (response.data.status) {
        return {
          success: true,
          paymentUrl: response.data.data.authorization_url,
          reference: request.reference,
          gatewayRef: response.data.data.access_code,
          data: response.data.data,
        };
      }

      return {
        success: false,
        reference: request.reference,
        gatewayRef: '',
        message: response.data.message || 'Failed to initiate payment',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        reference: request.reference,
        gatewayRef: '',
        message: error.response?.data?.message || error.message,
        data: error.response?.data,
      };
    }
  }

  async verifyPayment(
    request: VerifyPaymentRequest
  ): Promise<VerifyPaymentResponse> {
    try {
      const response = await this.client.get(
        `/transaction/verify/${request.reference}`
      );

      const data = response.data.data;

      if (response.data.status) {
        return {
          success: true,
          status: this.mapPaystackStatus(data.status),
          amount: data.amount / 100, // Convert from kobo to naira
          currency: data.currency,
          reference: data.reference,
          gatewayRef: data.id?.toString() || data.reference,
          paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
          customerEmail: data.customer?.email,
          cardLast4: data.authorization?.last4,
          cardBrand: data.authorization?.card_type,
          paymentMethod: data.channel,
          gatewayData: data,
        };
      }

      return {
        success: false,
        status: 'failed',
        amount: 0,
        currency: request.reference,
        reference: request.reference,
        gatewayRef: request.gatewayRef || '',
        message: response.data.message,
        gatewayData: data,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'failed',
        amount: 0,
        currency: 'NGN',
        reference: request.reference,
        gatewayRef: request.gatewayRef || '',
        message: error.response?.data?.message || error.message,
      };
    }
  }

  async refundPayment(
    request: RefundPaymentRequest
  ): Promise<RefundPaymentResponse> {
    try {
      const response = await this.client.post('/refund', {
        transaction: request.gatewayRef,
        amount: Math.round(request.amount * 100), // Convert to kobo
        customer_note: request.reason,
      });

      if (response.data.status) {
        return {
          success: true,
          refundRef: response.data.data.id?.toString() || '',
          amount: response.data.data.amount / 100,
          status: response.data.data.status,
          data: response.data.data,
        };
      }

      return {
        success: false,
        refundRef: '',
        amount: request.amount,
        status: 'failed',
        message: response.data.message,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        refundRef: '',
        amount: request.amount,
        status: 'failed',
        message: error.response?.data?.message || error.message,
        data: error.response?.data,
      };
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      throw new Error('Webhook secret not configured');
    }

    const hash = crypto
      .createHmac('sha512', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  parseWebhookEvent(payload: any): WebhookEvent {
    return {
      event: payload.event,
      data: payload.data,
    };
  }

  private mapPaystackStatus(
    status: string
  ): 'pending' | 'successful' | 'failed' | 'cancelled' {
    switch (status.toLowerCase()) {
      case 'success':
        return 'successful';
      case 'failed':
        return 'failed';
      case 'abandoned':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
