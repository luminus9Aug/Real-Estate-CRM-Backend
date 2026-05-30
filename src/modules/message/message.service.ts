import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateRequest } from 'twilio';
import type { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantPrismaService } from '../../common/utils/tenant-prisma.service';
import { MessageGateway } from '../../gateways/message.gateway';
import { WhatsappProducer } from '../../queues/whatsapp/whatsapp.producer';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessageService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappProducer,
    private readonly gateway: MessageGateway,
    private readonly config: ConfigService,
  ) {}

  async list(leadId: string): Promise<unknown[]> {
    return this.tenantPrisma.client.message.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async send(
    tenantId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<unknown> {
    const lead = await this.tenantPrisma.client.lead.findFirst({
      where: { id: dto.leadId, deletedAt: null },
    });
    if (!lead) throw new NotFoundException('Lead not found');

    const message = await this.tenantPrisma.client.message.create({
      data: {
        tenantId,
        leadId: dto.leadId,
        senderId: userId,
        content: dto.content,
        isFromLead: false,
      },
    });

    await this.whatsapp.enqueue({
      tenantId,
      leadId: dto.leadId,
      messageId: message.id,
      toPhone: lead.phone,
      body: dto.content,
    });

    this.gateway.emitNewMessage(tenantId, {
      leadId: dto.leadId,
      content: dto.content,
      isFromLead: false,
      createdAt: message.createdAt,
    });

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

    const lead = await this.prisma.lead.findFirst({
      where: { phone: from, deletedAt: null },
    });
    if (!lead) {
      return { ok: true };
    }

    const message = await this.prisma.message.create({
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
