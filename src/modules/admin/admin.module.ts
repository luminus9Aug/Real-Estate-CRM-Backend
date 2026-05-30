import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminTenantController } from './admin-tenant.controller';
import { AdminPlanController } from './admin-plan.controller';

@Module({
  controllers: [AdminController, AdminTenantController, AdminPlanController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
