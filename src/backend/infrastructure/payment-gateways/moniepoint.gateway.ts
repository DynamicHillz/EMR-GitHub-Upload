/**
 * Moniepoint Payment Gateway Implementation
 *
 * Implements the IPaymentGateway interface for Moniepoint
 * Moniepoint (formerly TeamApt) is a Nigerian payment processor
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

export class MoniepointGateway implements IPaymentGateway {
  readonly name = 'MONIEPOINT';
  private client: AxiosInstance;
  private config: PaymentGatewayConfig;

  constructor(config: PaymentGatewayConfig) {
    this.config = config;

    const baseURL =
      config.environment === 'production'
        ? 'https://api.moniepoint.com/v1'
        : 'https://sandbox.moniepoint.com/v1';

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
      const response = await this.client.post('/merchant/transactions/init-transaction', {
        amount: request.amount,
        currencyCode: request.currency,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        paymentReference: request.reference,
        paymentDescription: 'Medical Services Payment',
        redirectUrl: request.redirectUrl || request.callbackUrl,
        metadata: request.metadata,
      });

      if (response.data.requestSuccessful) {
        return {
          success: true,
          paymentUrl: response.data.responseBody.checkoutUrl,
          reference: request.reference,
          gatewayRef: response.data.responseBody.transactionReference,
          data: response.data.responseBody,
        };
      }

      return {
        success: false,
        reference: request.reference,
        gatewayRef: '',
        message: response.data.responseMessage || 'Failed to initiate payment',
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        reference: request.reference,
        gatewayRef: '',
        message: error.response?.data?.responseMessage || error.message,
        data: error.response?.data,
      };
    }
  }

  async verifyPayment(
    request: VerifyPaymentRequest
  ): Promise<VerifyPaymentResponse> {
    try {
      const response = await this.client.get(
        `/merchant/transactions/query?paymentReference=${request.reference}`
      );

      const data = response.data.responseBody;

      if (response.data.requestSuccessful && data.paymentStatus === 'PAID') {
        return {
          success: true,
          status: 'successful',
          amount: parseFloat(data.amount),
          currency: data.currencyCode,
          reference: data.paymentReference,
          gatewayRef: data.transactionReference,
          paidAt: data.paidOn ? new Date(data.paidOn) : undefined,
          customerEmail: data.customer?.email,
          cardLast4: data.cardDetails?.last4,
          cardBrand: data.cardDetails?.brand,
          paymentMethod: data.paymentMethod,
          gatewayData: data,
        };
      }

      return {
        success: false,
        status: this.mapMoniepointStatus(data.paymentStatus),
        amount: parseFloat(data.amount || '0'),
        currency: data.currencyCode || 'NGN',
        reference: request.reference,
        gatewayRef: data.transactionReference || request.gatewayRef || '',
        message: response.data.responseMessage,
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
        message: error.response?.data?.responseMessage || error.message,
      };
    }
  }

  async refundPayment(
    request: RefundPaymentRequest
  ): Promise<RefundPaymentResponse> {
    try {
      const response = await this.client.post('/merchant/transactions/refund', {
        transactionReference: request.gatewayRef,
        refundAmount: request.amount,
        refundReason: request.reason,
      });

      if (response.data.requestSuccessful) {
        return {
          success: true,
          refundRef: response.data.responseBody.refundReference || '',
          amount: response.data.responseBody.refundAmount,
          status: response.data.responseBody.refundStatus,
          data: response.data.responseBody,
        };
      }

      return {
        success: false,
        refundRef: '',
        amount: request.amount,
        status: 'failed',
        message: response.data.responseMessage,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        refundRef: '',
        amount: request.amount,
        status: 'failed',
        message: error.response?.data?.responseMessage || error.message,
        data: error.response?.data,
      };
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret || !signature) {
      return false;
    }

    // Moniepoint uses HMAC SHA512 for webhook verification
    const hash = crypto
      .createHmac('sha512', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    const hashBuf = Buffer.from(hash);
    const signatureBuf = Buffer.from(signature);

    if (hashBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuf, signatureBuf);
  }

  parseWebhookEvent(payload: any): WebhookEvent {
    return {
      event: payload.eventType || 'transaction.update',
      data: payload.eventData || payload,
    };
  }

  private mapMoniepointStatus(
    status: string
  ): 'pending' | 'successful' | 'failed' | 'cancelled' {
    switch (status?.toUpperCase()) {
      case 'PAID':
        return 'successful';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
      case 'EXPIRED':
        return 'cancelled';
      case 'PENDING':
      case 'INITIATED':
      default:
        return 'pending';
    }
  }
}
