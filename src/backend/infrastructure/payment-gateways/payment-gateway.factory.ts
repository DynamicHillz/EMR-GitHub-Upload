/**
 * Payment Gateway Factory
 *
 * Factory for creating payment gateway instances based on provider
 * Supports multiple payment processors
 */

import { IPaymentGateway, PaymentGatewayConfig } from './payment-gateway.interface';
import { FlutterwaveGateway } from './flutterwave.gateway';
import { PaystackGateway } from './paystack.gateway';
import { MoniepointGateway } from './moniepoint.gateway';

export type PaymentGatewayProvider =
  | 'FLUTTERWAVE'
  | 'PAYSTACK'
  | 'MONIEPOINT'
  | 'STRIPE'
  | 'INTERSWITCH'
  | 'REMITA'
  | 'PAYPAL'
  | 'SQUARE'
  | 'RAZORPAY';

export class PaymentGatewayFactory {
  private static gateways: Map<string, IPaymentGateway> = new Map();

  /**
   * Get payment gateway instance
   * Creates and caches gateway instances
   */
  static getGateway(
    provider: PaymentGatewayProvider,
    config: PaymentGatewayConfig
  ): IPaymentGateway {
    const key = `${provider}_${config.environment}`;

    // Return cached instance if exists
    if (this.gateways.has(key)) {
      return this.gateways.get(key)!;
    }

    // Create new instance based on provider
    let gateway: IPaymentGateway;

    switch (provider) {
      case 'FLUTTERWAVE':
        gateway = new FlutterwaveGateway(config);
        break;

      case 'PAYSTACK':
        gateway = new PaystackGateway(config);
        break;

      case 'MONIEPOINT':
        gateway = new MoniepointGateway(config);
        break;

      case 'STRIPE':
        // TODO: Implement Stripe gateway
        throw new Error('Stripe gateway not yet implemented');

      case 'INTERSWITCH':
        // TODO: Implement Interswitch gateway
        throw new Error('Interswitch gateway not yet implemented');

      case 'REMITA':
        // TODO: Implement Remita gateway
        throw new Error('Remita gateway not yet implemented');

      case 'PAYPAL':
        // TODO: Implement PayPal gateway
        throw new Error('PayPal gateway not yet implemented');

      case 'SQUARE':
        // TODO: Implement Square gateway
        throw new Error('Square gateway not yet implemented');

      case 'RAZORPAY':
        // TODO: Implement Razorpay gateway
        throw new Error('Razorpay gateway not yet implemented');

      default:
        throw new Error(`Unsupported payment gateway: ${provider}`);
    }

    // Cache and return
    this.gateways.set(key, gateway);
    return gateway;
  }

  /**
   * Get gateway configuration from environment variables
   */
  static getConfigFromEnv(provider: PaymentGatewayProvider): PaymentGatewayConfig {
    const envPrefix = provider.toUpperCase();

    return {
      publicKey: process.env[`${envPrefix}_PUBLIC_KEY`] || '',
      secretKey: process.env[`${envPrefix}_SECRET_KEY`] || '',
      webhookSecret: process.env[`${envPrefix}_WEBHOOK_SECRET`],
      environment:
        (process.env.NODE_ENV as 'test' | 'production') === 'production'
          ? 'production'
          : 'test',
    };
  }

  /**
   * Clear cached gateways (useful for testing)
   */
  static clearCache(): void {
    this.gateways.clear();
  }
}
