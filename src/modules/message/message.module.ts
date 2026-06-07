import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { WhatsappQueueModule } from '../../queues/whatsapp/whatsapp.queue.module';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

import { SubscriptionModule } from '../subscription/subscription.module';
import { MessageRepository } from './message.repository';
import { LeadRepository } from '../lead/lead.repository';

@Module({
  imports: [WhatsappQueueModule, GatewayModule, SubscriptionModule],
  controllers: [MessageController],
  providers: [MessageService, MessageRepository, LeadRepository],
})
export class MessageModule {}
