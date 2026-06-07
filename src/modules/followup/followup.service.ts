import { Injectable, NotFoundException } from '@nestjs/common';
import { FollowUpRepository } from './followup.repository';
import { LeadRepository } from '../lead/lead.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { FollowupProducer } from '../../queues/followup/followup.producer';
import { CreateFollowupDto } from './dto/create-followup.dto';

@Injectable()
export class FollowupService {
  constructor(
    private readonly followupRepository: FollowUpRepository,
    private readonly leadRepository: LeadRepository,
    private readonly followupProducer: FollowupProducer,
  ) {}

  async list(user: AuthUser): Promise<unknown[]> {
    return this.followupRepository.findMany(user, {
      where: { completedAt: null },
      orderBy: { dueAt: 'asc' },
      include: { lead: true, assignedTo: true },
    });
  }

  async create(user: AuthUser, dto: CreateFollowupDto): Promise<unknown> {
    const lead = await this.leadRepository.findFirst(user, {
      where: { id: dto.leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const followUp = await this.followupRepository.create(user, {
      data: {
        tenantId: user.tenantId!,
        leadId: dto.leadId,
        assignedToId: dto.assignedToId,
        message: dto.message,
        dueAt: new Date(dto.dueAt),
      },
      include: { lead: true },
    });

    if (user.tenantId) {
      const delayMs = Math.max(0, new Date(dto.dueAt).getTime() - Date.now());
      await this.followupProducer.scheduleCheck(user.tenantId, followUp.id, delayMs);
    }

    return followUp;
  }

  async complete(user: AuthUser, id: string): Promise<unknown> {
    const existing = await this.followupRepository.findFirst(user, {
      where: { id, completedAt: null },
      include: { lead: true },
    });
    if (!existing) throw new NotFoundException('Follow-up not found');

    return this.followupRepository.update(user, {
      where: { id },
      data: { completedAt: new Date() },
      include: { lead: true },
    });
  }
}
