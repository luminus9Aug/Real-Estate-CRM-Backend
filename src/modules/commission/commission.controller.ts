import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayCommissionDto } from './dto/pay-commission.dto';
import { CommissionService } from './commission.service';

@Controller('commission')
export class CommissionController {
  constructor(private readonly commission: CommissionService) {}

  @Get('pending')
  pending(@CurrentUser('tenantId') tenantId: string): Promise<unknown[]> {
    return this.commission.listPending(tenantId);
  }

  @Get('my')
  my(@CurrentUser('id') userId: string): Promise<unknown[]> {
    return this.commission.listMy(userId);
  }

  @Get('agent/:agentId')
  forAgent(
    @Param('agentId') agentId: string,
    @CurrentUser('id') viewerId: string,
    @CurrentUser('role') role: UserRole,
  ): Promise<unknown[]> {
    return this.commission.listForAgent(agentId, viewerId, role);
  }

  @Roles(UserRole.OWNER)
  @Post(':id/pay')
  pay(
    @Param('id') id: string,
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('id') userId: string,
    @Body() dto: PayCommissionDto,
  ): Promise<unknown> {
    return this.commission.payCommission(id, tenantId, userId, dto);
  }
}
