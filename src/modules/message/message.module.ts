import { Module } from '@nestjs/common';
import { GatewayModule } from '../../gateways/gateway.module';
import { WhatsappQueueModule } from '../../queues/whatsapp/whatsapp.queue.module';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';

@Module({
  imports: [WhatsappQueueModule, GatewayModule],
  controllers: [MessageController],
  providers: [MessageService],
})
export class MessageModule {}
