/**
 * Payment Gateway Webhook Controller
 *
 * Receives server-to-server push notifications from Flutterwave/Paystack/
 * Moniepoint so a payment gets reconciled even if the patient closes their
 * browser right after paying (previously only the client-initiated `verify`
 * call would reconcile it).
 *
 * NOT behind authMiddleware — gateways aren't logged-in users. The only
 * protection is the signature check below, so it must run correctly and
 * fail closed.
 */

import { Request, Response } from 'express';
import { logger } from '../../config/logger';
import { prisma } from '../../infrastructure/database/prisma.client';
import { PaymentGatewayFactory } from '../../infrastructure/payment-gateways/payment-gateway.factory';
import { PaymentGatewayProvider } from '../../infrastructure/payment-gateways/types';
import { VerifyGatewayPaymentUseCase } from '../../application/use-cases/billing/verify-gateway-payment.use-case';

const verifyGatewayPaymentUseCase = new VerifyGatewayPaymentUseCase(prisma);

const SIGNATURE_HEADERS: Record<string, string> = {
  FLUTTERWAVE: 'verif-hash',
  PAYSTACK: 'x-paystack-signature',
  MONIEPOINT: 'x-signature',
};

const extractReference = (data: any): string | undefined => {
  return data?.tx_ref || data?.reference || data?.paymentReference;
};

export const handlePaymentWebhook = async (req: Request, res: Response) => {
  const providerParam = (req.params.provider || '').toUpperCase();

  if (!['FLUTTERWAVE', 'PAYSTACK', 'MONIEPOINT'].includes(providerParam)) {
    return res.status(400).json({ success: false, message: 'Unknown payment gateway provider' });
  }

  const provider = providerParam as PaymentGatewayProvider;

  // express.raw() gives us a Buffer here — needed for signature verification
  // against the exact bytes the gateway signed.
  const rawBody: Buffer = req.body;
  const rawBodyString = rawBody?.toString('utf8') || '';

  const signatureHeader = SIGNATURE_HEADERS[providerParam];
  const signature = req.headers[signatureHeader] as string | undefined;

  try {
    const gatewayConfig = PaymentGatewayFactory.getConfigFromEnv(provider);
    const gateway = PaymentGatewayFactory.getGateway(provider, gatewayConfig);

    const isValid = signature ? gateway.verifyWebhookSignature(rawBodyString, signature) : false;

    if (!isValid) {
      logger.warn(`Payment webhook: rejected invalid/missing signature for ${providerParam}`);
      return res.status(401).json({ success: false, message: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBodyString);
    const event = gateway.parseWebhookEvent(payload);
    const reference = extractReference(event.data);

    if (!reference) {
      logger.error(`Payment webhook: could not extract a reference from ${providerParam} payload`);
      return res.status(200).json({ success: true, message: 'No reference found, ignored' });
    }

    // Resolve tenantId from the payment row itself — a webhook has no JWT/tenant
    // context, so this is the one place in the codebase where an unscoped
    // lookup by paymentNumber is correct rather than a bug.
    const payment = await prisma.payment.findFirst({
      where: { paymentNumber: reference, gatewayProvider: providerParam },
      select: { tenantId: true },
    });

    if (!payment) {
      logger.error(`Payment webhook: no payment found for reference ${reference} (${providerParam})`);
      return res.status(200).json({ success: true, message: 'Payment not found, ignored' });
    }

    // Re-verify against the gateway's own verify endpoint rather than trusting
    // the webhook body for amount/status — the webhook is just the trigger.
    const result = await verifyGatewayPaymentUseCase.execute(reference, payment.tenantId);
    logger.info(
      `Payment webhook: processed ${providerParam} reference ${reference} (alreadyProcessed=${result.alreadyProcessed})`
    );

    return res.status(200).json({ success: true });
  } catch (error: any) {
    // Signature was valid but processing failed — acknowledge anyway so the
    // gateway doesn't retry-storm us; the client-initiated /verify endpoint
    // remains a fallback if this needs manual follow-up.
    logger.error(`Payment webhook: error processing ${providerParam} event`, error);
    return res.status(200).json({ success: false, message: 'Processing error logged' });
  }
};
