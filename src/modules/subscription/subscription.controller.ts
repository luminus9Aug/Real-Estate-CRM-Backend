import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';

@Controller('subscription')
@UseGuards(SubscriptionActiveGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('current')
  async getCurrent(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getCurrentSubscription(user.tenantId!);
  }

  @Post('upgrade')
  async upgrade(@CurrentUser() user: AuthUser, @Body('planId') planId: string) {
    return this.subscriptionService.changePlan(user.tenantId!, planId);
  }

  @Post('cancel')
  async cancel(@CurrentUser() user: AuthUser, @Body('atPeriodEnd') atPeriodEnd: boolean) {
    return this.subscriptionService.cancelSubscription(user.tenantId!, atPeriodEnd);
  }
}
