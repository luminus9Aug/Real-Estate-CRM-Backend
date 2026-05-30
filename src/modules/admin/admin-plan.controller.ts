import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Patch, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@Controller('admin/plans')
@UseGuards(SuperAdminGuard)
export class AdminPlanController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async listPlans() {
    return this.adminService.findAllPlans();
  }

  @Post()
  async createPlan(@Body() dto: any) {
    return this.adminService.createPlan(dto);
  }

  @Put(':id')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.adminService.updatePlan(id, dto);
  }

  @Patch(':id/set-default')
  async setDefaultPlan(
    @Param('id') id: string,
    @Req() req: any
  ) {
    return this.adminService.setDefaultPlan(id, req.user.sub);
  }

  @Delete(':id')
  async deletePlan(@Param('id') id: string) {
    return this.adminService.deletePlan(id);
  }
}
