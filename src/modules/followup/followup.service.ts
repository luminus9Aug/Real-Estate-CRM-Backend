import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { FollowupProducer } from '../../queues/followup/followup.producer';
import { CreateFollowupDto } from './dto/create-followup.dto';

@Injectable()
export class FollowupService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly followupProducer: FollowupProducer,
  ) {}

  async list(tenantId: string): Promise<unknown[]> {
    return this.tenantPrisma.client.followUp.findMany({
      where: { tenantId, completedAt: null },
      orderBy: { dueAt: 'asc' },
      include: { lead: true, assignedTo: true },
    });
  }

  async create(tenantId: string, dto: CreateFollowupDto): Promise<unknown> {
    const lead = await this.tenantPrisma.client.lead.findFirst({
      where: { id: dto.leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const followUp = await this.tenantPrisma.client.followUp.create({
      data: {
        tenantId,
        leadId: dto.leadId,
        assignedToId: dto.assignedToId,
        message: dto.message,
        dueAt: new Date(dto.dueAt),
      },
      include: { lead: true },
    });

    const delayMs = Math.max(0, new Date(dto.dueAt).getTime() - Date.now());
    await this.followupProducer.scheduleCheck(tenantId, followUp.id, delayMs);

    return followUp;
  }

  async complete(id: string): Promise<unknown> {
    const existing = await this.tenantPrisma.client.followUp.findFirst({
      where: { id, completedAt: null },
      include: { lead: true },
    });
    if (!existing) throw new NotFoundException('Follow-up not found');

    return this.tenantPrisma.client.followUp.update({
      where: { id },
      data: { completedAt: new Date() },
      include: { lead: true },
    });
  }
}
