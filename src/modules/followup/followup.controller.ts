import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { CreateFollowupDto } from './dto/create-followup.dto';
import { FollowupService } from './followup.service';

@Controller('followups')
export class FollowupController {
  constructor(private readonly followups: FollowupService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<unknown[]> {
    return this.followups.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateFollowupDto,
  ): Promise<unknown> {
    return this.followups.create(user, dto);
  }

  @Put(':id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.followups.complete(user, id);
  }
}
