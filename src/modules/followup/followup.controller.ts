import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { FollowupService } from './followup.service';

@Controller('followups')
export class FollowupController {
  constructor(private readonly followups: FollowupService) {}

  @Get()
  list(@CurrentUser('tenantId') tenantId: string): Promise<unknown[]> {
    return this.followups.list(tenantId);
  }

  @Post()
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateFollowupDto,
  ): Promise<unknown> {
    return this.followups.create(tenantId, dto);
  }

  @Put(':id/complete')
  complete(@Param('id') id: string): Promise<unknown> {
    return this.followups.complete(id);
  }
}
