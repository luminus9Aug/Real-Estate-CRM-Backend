import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRequest } from 'twilio';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageRepository } from './message.repository';
import { LeadRepository } from '../lead/lead.repository';
import { AuthUser } from '../auth/types/auth-user.type';
import { UserRole } from '../../common/constants/roles.constants';
import { MessageGateway } from '../../gateways/message.gateway';
import { WhatsappProducer } from '../../queues/whatsapp/whatsapp.producer';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly leadRepository: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappProducer,
    private readonly gateway: MessageGateway,
    private readonly config: ConfigService,
  ) {}

  async list(user: AuthUser, leadId: string): Promise<unknown[]> {
    return this.messageRepository.findMany(user, {
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(
    user: AuthUser,
    dto: SendMessageDto,
  ): Promise<unknown> {
    const lead = await this.leadRepository.findFirst(user, {
      where: { id: dto.leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const message = await this.messageRepository.create(user, {
      data: {
        tenantId: user.tenantId!,
        leadId: dto.leadId,
        senderId: user.id,
        content: dto.content,
        isFromLead: false,
      },
    });

    await this.whatsapp.enqueue({
      tenantId: user.tenantId!,
      leadId: dto.leadId,
      messageId: message.id,
      toPhone: lead.phone,
      body: dto.content,
    });

    if (user.tenantId) {
      this.gateway.emitNewMessage(user.tenantId, {
        leadId: dto.leadId,
        content: dto.content,
        isFromLead: false,
        createdAt: message.createdAt,
      });
    }

    return message;
  }

  async handleWhatsappWebhook(req: Request): Promise<{ ok: true }> {
    const authToken = this.config.get<string>('whatsapp.twilioAuthToken') ?? '';
    const url = this.config.get<string>('whatsapp.twilioWebhookUrl') ?? '';
    const signature = req.headers['x-twilio-signature'] as string | undefined;
    if (!signature) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const body = req.body as Record<string, string>;
    const valid = validateRequest(authToken, signature, url, body);
    if (!valid) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const from = body.From ?? body.WaId;
    const text = body.Body ?? '';
    if (!from) {
      return { ok: true };
    }

    const systemUser: AuthUser = { id: 'system', tenantId: null, role: UserRole.SUPER_ADMIN, email: 'system', hasFullDataAccess: true };
    const lead = await this.leadRepository.findFirst(systemUser, {
      where: { phone: from, deletedAt: null },
    });
    if (!lead) {
      return { ok: true };
    }

    const leadUser: AuthUser = { id: 'lead', tenantId: lead.tenantId, role: UserRole.AGENT, email: 'lead', hasFullDataAccess: false };
    const message = await this.messageRepository.create(leadUser, {
      data: {
        tenantId: lead.tenantId,
        leadId: lead.id,
        content: text || '(no body)',
        isFromLead: true,
      },
    });

    this.gateway.emitNewMessage(lead.tenantId, {
      leadId: lead.id,
      content: message.content,
      isFromLead: true,
      createdAt: message.createdAt,
    });

    return { ok: true };
  }
}
