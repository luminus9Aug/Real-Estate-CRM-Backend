import { Controller, Get, Post, Body } from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types/auth-user.type";
import { PlanInterval } from "@prisma/client";

@Controller("subscription")
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get()
  async getCurrent(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getCurrentSubscription(user.tenantId!);
  }

  @Get("current")
  async getCurrentLegacy(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getCurrentSubscription(user.tenantId!);
  }

  @Get("features")
  async getUsage(@CurrentUser() user: AuthUser) {
    return this.subscriptionService.getSubscriptionUsage(user.tenantId!);
  }

  @Post("change-plan")
  async changePlan(
    @CurrentUser() user: AuthUser,
    @Body("planId") planId: string,
    @Body("interval") interval?: PlanInterval,
  ) {
    return this.subscriptionService.changePlan(
      user.tenantId!,
      planId,
      interval,
    );
  }

  @Post("upgrade")
  async upgradeLegacy(
    @CurrentUser() user: AuthUser,
    @Body("planId") planId: string,
  ) {
    return this.subscriptionService.changePlan(user.tenantId!, planId);
  }

  @Post("cancel")
  async cancel(
    @CurrentUser() user: AuthUser,
    @Body("atPeriodEnd") atPeriodEnd: boolean,
  ) {
    return this.subscriptionService.cancelSubscription(
      user.tenantId!,
      atPeriodEnd,
    );
  }
}
