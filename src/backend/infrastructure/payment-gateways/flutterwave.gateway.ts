/**
 * Flutterwave Payment Gateway Implementation
 *
 * Implements the IPaymentGateway interface for Flutterwave
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

export class FlutterwaveGateway implements IPaymentGateway {
  readonly name = 'FLUTTERWAVE';
  private client: AxiosInstance;
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;

    const baseURL =
      config.environment === 'production'
        ? 'https://api.flutterwave.com/v3'
        : 'https://api.flutterwave.com/v3'; // Flutterwave uses same URL for test/prod

    this.client = axios.create({
      baseURL,
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
      const response = await this.client.post('/payments', {
        tx_ref: request.reference,
        amount: request.amount,
        currency: request.currency,
        redirect_url: request.redirectUrl || request.callbackUrl,
        customer: {
          email: request.customerEmail,
          name: request.customerName,
          phonenumber: request.customerPhone,
        },
        meta: request.metadata,
        customizations: {
          title: 'St. Stephen EMR Payment',
          description: 'Medical Services Payment',
        },
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          paymentUrl: response.data.data.link,
          reference: request.reference,
          gatewayRef: response.data.data.id?.toString() || request.reference,
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
        `/transactions/verify_by_reference?tx_ref=${request.reference}`
      );

      const data = response.data.data;

      if (response.data.status === 'success') {
        return {
          success: true,
          status: this.mapFlutterwaveStatus(data.status),
          amount: parseFloat(data.amount),
          currency: data.currency,
          reference: data.tx_ref,
          gatewayRef: data.id?.toString() || data.flw_ref,
          paidAt: data.created_at ? new Date(data.created_at) : undefined,
          customerEmail: data.customer?.email,
          cardLast4: data.card?.last_4digits,
          cardBrand: data.card?.type,
          paymentMethod: data.payment_type,
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
      const response = await this.client.post('/refunds', {
        id: request.gatewayRef,
        amount: request.amount,
        comments: request.reason,
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          refundRef: response.data.data.id?.toString() || '',
          amount: response.data.data.amount,
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
      .createHmac('sha256', this.config.webhookSecret)
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

  private mapFlutterwaveStatus(
    status: string
  ): 'pending' | 'successful' | 'failed' | 'cancelled' {
    switch (status.toLowerCase()) {
      case 'successful':
        return 'successful';
      case 'failed':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}
