import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateLanguageDto } from './dto/update-language.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get()
  list(@CurrentUser('tenantId') tenantId: string): Promise<Record<string, unknown>[]> {
    return this.users.list(tenantId);
  }

  @Put('me/language')
  updateLanguage(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateLanguageDto,
  ): Promise<Record<string, unknown>> {
    return this.users.updateLanguage(userId, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.users.findOne(id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  create(@CurrentUser('tenantId') tenantId: string, @Body() dto: CreateUserDto): Promise<Record<string, unknown>> {
    return this.users.create(tenantId, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<Record<string, unknown>> {
    return this.users.update(id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<Record<string, unknown>> {
    return this.users.softDelete(id);
  }
}
