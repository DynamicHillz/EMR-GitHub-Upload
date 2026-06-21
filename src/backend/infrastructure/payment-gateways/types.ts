/**
 * Payment Gateway Types
 * Type definitions for payment gateway integrations
 */

export enum PaymentGatewayProvider {
  PAYSTACK = 'PAYSTACK',
  FLUTTERWAVE = 'FLUTTERWAVE',
  MONIEPOINT = 'MONIEPOINT',
}

export interface PaymentVerificationResponse {
  success: boolean;
  reference: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
  gateway: string;
  metadata?: any;
}

export interface PaymentInitiationResponse {
  success: boolean;
  authorizationUrl: string;
  reference: string;
  accessCode?: string;
}

export interface PaymentGatewayConfig {
  publicKey: string;
  secretKey: string;
  callbackUrl: string;
}
