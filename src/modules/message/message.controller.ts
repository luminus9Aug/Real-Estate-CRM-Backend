import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { MessageService } from './message.service';

import { UseGuards } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { FeatureGateGuard } from '../../common/guards/feature-gate.guard';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureKey } from '../../common/constants/features.constants';

@UseGuards(SubscriptionActiveGuard, FeatureGateGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messages: MessageService) {}

  @Get()
  list(@Query('leadId') leadId: string): Promise<unknown[]> {
    if (!leadId) {
      return Promise.resolve([]);
    }
    return this.messages.list(leadId);
  }

  @RequireFeature(FeatureKey.WHATSAPP_INTEGRATION)
  @Post()
  send(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: SendMessageDto,
  ): Promise<unknown> {
    return this.messages.send(tenantId, userId, dto);
  }

  @Public()
  @Post('webhook/whatsapp')
  webhook(@Req() req: Request): Promise<{ ok: true }> {
    return this.messages.handleWhatsappWebhook(req);
  }
}
