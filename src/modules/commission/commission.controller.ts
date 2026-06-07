import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { Roles } from '../../common/decorators/roles.decorator';
import { PayCommissionDto } from './dto/pay-commission.dto';
import { CommissionService } from './commission.service';

@Controller('commission')
export class CommissionController {
  constructor(private readonly commission: CommissionService) {}

  @Get('pending')
  pending(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.commission.listPending(user);
  }

  @Get('my')
  my(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.commission.listMy(user);
  }

  @Get('agent/:agentId')
  forAgent(
    @CurrentUser() user: AuthUser,
    @Param('agentId') agentId: string,
  ): Promise<unknown[]> {
    return this.commission.listForAgent(user, agentId);
  }

  @Roles(UserRole.OWNER)
  @Post(':id/pay')
  pay(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: PayCommissionDto,
  ): Promise<unknown> {
    return this.commission.payCommission(user, id, dto);
  }
}
