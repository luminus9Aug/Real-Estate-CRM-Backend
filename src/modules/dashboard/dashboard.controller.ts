import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('stats')
  stats(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.dashboard.stats(user);
  }

  @Get('charts')
  charts(@CurrentUser() user: AuthUser): Promise<Record<string, unknown>> {
    return this.dashboard.charts(user);
  }

  @Get('activity')
  activity(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.dashboard.activity(user);
  }

  @Get('team-performance')
  teamPerformance(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.dashboard.teamPerformance(user);
  }
}
