/**
 * Payment Gateway Interface
 *
 * Common interface for all payment gateway integrations
 * Supports multiple providers: Flutterwave, Paystack, Stripe, Interswitch, etc.
 */

export interface PaymentGatewayConfig {
  publicKey: string;
  secretKey: string;
  webhookSecret?: string;
  environment: 'test' | 'production';
}

export interface InitiatePaymentRequest {
  amount: number;
  currency: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  reference: string;
  metadata?: Record<string, any>;
  callbackUrl?: string;
  redirectUrl?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  paymentUrl?: string;
  reference: string;
  gatewayRef: string;
  message?: string;
  data?: any;
}

export interface VerifyPaymentRequest {
  reference: string;
  gatewayRef?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  status: 'pending' | 'successful' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
  reference: string;
  gatewayRef: string;
  paidAt?: Date;
  customerEmail?: string;
  cardLast4?: string;
  cardBrand?: string;
  paymentMethod?: string;
  gatewayData?: any;
  message?: string;
}

export interface RefundPaymentRequest {
  gatewayRef: string;
  amount: number;
  reason?: string;
}

export interface RefundPaymentResponse {
  success: boolean;
  refundRef: string;
  amount: number;
  status: string;
  message?: string;
  data?: any;
}

export interface WebhookEvent {
  event: string;
  data: any;
  signature?: string;
}

export interface IPaymentGateway {
  /**
   * Gateway name/identifier
   */
  readonly name: string;

  /**
   * Initialize payment and get payment URL
   */
  initiatePayment(request: InitiatePaymentRequest): Promise<InitiatePaymentResponse>;

  /**
   * Verify payment status
   */
  verifyPayment(request: VerifyPaymentRequest): Promise<VerifyPaymentResponse>;

  /**
   * Process refund
   */
  refundPayment(request: RefundPaymentRequest): Promise<RefundPaymentResponse>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  /**
   * Parse webhook event
   */
  parseWebhookEvent(payload: any): WebhookEvent;
}
