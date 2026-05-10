import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReportService } from './report.service';

@Controller('report')
export class ReportController {
  constructor(private readonly report: ReportService) {}

  @Get('commission/team')
  teamCommission(@CurrentUser('tenantId') tenantId: string): Promise<unknown[]> {
    return this.report.teamCommission(tenantId);
  }

  @Get('agent-performance')
  agentPerformance(@CurrentUser('tenantId') tenantId: string): Promise<unknown[]> {
    return this.report.agentPerformance(tenantId);
  }
}
