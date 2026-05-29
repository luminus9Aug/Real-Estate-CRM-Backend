import { Controller, Post, Body, Headers, BadRequestException, RawBodyRequest, Req } from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { BillingService } from './billing.service';
import { RazorpayWebhookPayload } from './types/razorpay.types';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Public()
  @Post('webhook/razorpay')
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
    @Body() payload: RazorpayWebhookPayload,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing signature');
    }

    // Verify signature using raw body
    if (!req.rawBody) {
      throw new BadRequestException('Raw body is missing');
    }

    const isValid = this.billingService.validateWebhookSignature(
      req.rawBody.toString(),
      signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid signature');
    }

    const eventId = payload.id || (req.headers['x-razorpay-event-id'] as string);
    return this.billingService.processWebhook(eventId, payload);
  }
}
