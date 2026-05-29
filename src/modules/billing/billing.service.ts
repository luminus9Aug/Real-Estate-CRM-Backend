import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingProducer } from '../../queues/billing/billing.producer';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import { RazorpayWebhookPayload } from './types/razorpay.types';

@Injectable()
export class BillingService {
  private readonly razorpay: Razorpay;
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billingProducer: BillingProducer,
  ) {
    const keyId = this.config.get<string>('billing.razorpayKeyId');
    const keySecret = this.config.get<string>('billing.razorpaySecret');

    if (!keyId || !keySecret) {
      this.logger.warn('Razorpay credentials missing. Billing features will be limited.');
    }

    this.razorpay = new Razorpay({
      key_id: keyId || 'placeholder',
      key_secret: keySecret || 'placeholder',
    });
  }

  /**
   * Creates a Razorpay order for a subscription or one-time payment
   */
  async createOrder(tenantId: string, amount: number, currency: string = 'INR', metadata?: Record<string, string | number | boolean>) {
    const options = {
      amount: Math.round(Number(amount) * 100), // convert to paise
      currency,
      receipt: `rcpt_${tenantId.slice(0, 8)}_${Date.now()}`,
      notes: {
        tenantId,
        ...metadata,
      },
    };

    try {
      const order = await this.razorpay.orders.create(options);
      return order;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Razorpay order creation failed: ${message}`, stack);
      throw new InternalServerErrorException('Payment gateway error');
    }
  }

  /**
   * Verifies the payment signature from the client
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = this.config.get<string>('billing.razorpaySecret');
    if (!secret) return false;

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return expectedSignature === signature;
  }

  /**
   * Validates Razorpay Webhook Signature
   */
  validateWebhookSignature(body: string, signature: string): boolean {
    const webhookSecret = this.config.get<string>('billing.webhookSecret');
    if (!webhookSecret) return false;

    try {
      return Razorpay.validateWebhookSignature(body, signature, webhookSecret);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Webhook signature validation failed: ${message}`);
      return false;
    }
  }

  /**
   * Pushes a webhook event to the queue for background processing
   */
  async processWebhook(eventId: string, payload: RazorpayWebhookPayload) {
    await this.billingProducer.addWebhookJob(eventId, payload);
    return { ok: true };
  }

  /**
   * The actual logic for processing a webhook (called from the queue)
   */
  async executeWebhookLogic(eventId: string, payload: RazorpayWebhookPayload) {
    // 1. Check for idempotency
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { eventId },
    });

    if (existing && existing.processed) {
      this.logger.log(`Webhook event ${eventId} already processed. Skipping.`);
      return { ok: true };
    }

    // 2. Record the event
    if (!existing) {
      await this.prisma.webhookEvent.create({
        data: {
          id: crypto.randomUUID(),
          provider: 'RAZORPAY',
          eventId,
          eventType: payload.event,
          payload: payload as unknown as import('@prisma/client').Prisma.InputJsonValue, // Prisma Json field accepts InputJsonValue
          processed: false,
        },
      });
    }

    try {
      // 3. Handle different event types
      switch (payload.event) {
        case 'payment.captured':
          if (payload.payload.payment) {
            await this.handlePaymentCaptured(payload.payload.payment.entity);
          }
          break;
        case 'subscription.activated':
          if (payload.payload.subscription) {
            await this.handleSubscriptionEvent(payload.payload.subscription.entity, 'ACTIVE');
          }
          break;
        case 'subscription.charged':
          if (payload.payload.subscription && payload.payload.payment) {
            await this.handleSubscriptionCharged(payload.payload.subscription.entity, payload.payload.payment.entity);
          }
          break;
        case 'subscription.halted':
        case 'subscription.cancelled':
          if (payload.payload.subscription) {
            await this.handleSubscriptionEvent(payload.payload.subscription.entity, 'CANCELLED');
          }
          break;
      }

      // 4. Mark as processed
      await this.prisma.webhookEvent.update({
        where: { eventId },
        data: { processed: true },
      });

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error processing webhook ${eventId}: ${message}`, stack);
      throw error;
    }
  }

  private async handlePaymentCaptured(payment: Record<string, unknown>) {
    this.logger.log(`Payment captured: ${payment.id} for amount ${payment.amount}`);
    // Additional logic if needed for one-time payments
  }

  private async handleSubscriptionEvent(razorpaySub: Record<string, unknown>, status: string) {
    const notes = razorpaySub.notes as Record<string, string> | undefined;
    const tenantId = notes?.tenantId;
    if (!tenantId) return;

    this.logger.log(`Subscription ${razorpaySub.id} for tenant ${tenantId} updated to ${status}`);
    
    // Update local subscription and tenant status
    // Logic here...
  }

  private async handleSubscriptionCharged(razorpaySub: Record<string, unknown>, payment: Record<string, unknown>) {
    const notes = razorpaySub.notes as Record<string, string> | undefined;
    const tenantId = notes?.tenantId;
    if (!tenantId) return;

    this.logger.log(`Subscription ${razorpaySub.id} charged: ${payment.id}`);
    
    // Create Invoice record
    // Logic here...
  }
}
