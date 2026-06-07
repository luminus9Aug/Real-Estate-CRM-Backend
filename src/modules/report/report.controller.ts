import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { ReportService } from './report.service';

import { UseGuards } from '@nestjs/common';
import { SubscriptionActiveGuard } from '../../common/guards/subscription-active.guard';
import { FeatureGateGuard } from '../../common/guards/feature-gate.guard';
import { RequireFeature } from '../../common/decorators/require-feature.decorator';
import { FeatureKey } from '../../common/constants/features.constants';

@UseGuards(SubscriptionActiveGuard, FeatureGateGuard)
@RequireFeature(FeatureKey.ADVANCED_REPORTS)
@Controller('report')
export class ReportController {
  constructor(private readonly report: ReportService) {}

  @Get('commission/team')
  teamCommission(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.report.teamCommission(user);
  }

  @Get('agent-performance')
  agentPerformance(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.report.agentPerformance(user);
  }
}
