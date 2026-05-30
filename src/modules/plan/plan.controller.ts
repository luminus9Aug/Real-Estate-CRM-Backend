import { Controller, Get, Param } from '@nestjs/common';
import { PlanService } from './plan.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Public()
  @Get()
  async findAll() {
    return this.planService.findAllActive();
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.planService.findOne(id);
  }
}
