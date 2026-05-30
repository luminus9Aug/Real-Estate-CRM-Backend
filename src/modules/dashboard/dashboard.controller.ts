import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats(@CurrentUser('tenantId') tenantId: string): Promise<Record<string, unknown>> {
    return this.dashboard.stats(tenantId);
  }

  @Get('charts')
  charts(@CurrentUser('tenantId') tenantId: string): Promise<Record<string, unknown>> {
    return this.dashboard.charts(tenantId);
  }

  @Get('activity')
  activity(@CurrentUser('tenantId') tenantId: string): Promise<unknown[]> {
    return this.dashboard.activity(tenantId);
  }
}
