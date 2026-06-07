import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types/auth-user.type";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateLanguageDto } from "./dto/update-language.dto";
import { ToggleFullAccessDto } from "./dto/toggle-full-access.dto";
import { UserService } from "./user.service";
import { RolesGuard } from "../../common/guards/roles.guard";

import { UseGuards, ForbiddenException } from "@nestjs/common";
import { SubscriptionActiveGuard } from "../../common/guards/subscription-active.guard";
import { FeatureGateGuard } from "../../common/guards/feature-gate.guard";
import { SubscriptionService } from "../subscription/subscription.service";
import { FeatureKey } from "../../common/constants/features.constants";

@UseGuards(SubscriptionActiveGuard, FeatureGateGuard)
@Controller("users")
export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Get()
  list(
    @CurrentUser() user: AuthUser,
  ): Promise<Record<string, unknown>[]> {
    return this.users.list(user);
  }

  @Put("me/language")
  updateLanguage(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateLanguageDto,
  ): Promise<Record<string, unknown>> {
    return this.users.updateLanguage(user, dto);
  }

  @Get(":id")
  findOne(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Record<string, unknown>> {
    return this.users.findOne(user, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Post()
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateUserDto,
  ): Promise<Record<string, unknown>> {
    const count = await this.users.countActiveAgents(user);
    const ok = await this.subscriptionService.validateFeatureLimit(
      user.tenantId!,
      FeatureKey.MAX_AGENTS,
      count,
    );

    if (!ok) {
      throw new ForbiddenException({
        code: "PLAN_LIMIT_REACHED",
        featureKey: FeatureKey.MAX_AGENTS,
        message: "Agent limit reached for your plan. Please upgrade.",
      });
    }

    return this.users.create(user, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Put(":id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<Record<string, unknown>> {
    return this.users.update(user, id, dto);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<Record<string, unknown>> {
    return this.users.softDelete(user, id);
  }

  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @UseGuards(RolesGuard)
  @Patch(":id/full-access")
  toggleFullAccess(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: ToggleFullAccessDto,
  ): Promise<Record<string, unknown>> {
    return this.users.toggleFullAccess(user, id, dto);
  }
}
