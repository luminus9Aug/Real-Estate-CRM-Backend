import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { WHATSAPP_QUEUE, WhatsappProducer } from './whatsapp.producer';
import { WhatsappProcessor } from './whatsapp.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: WHATSAPP_QUEUE,
    }),
  ],
  providers: [WhatsappProducer, WhatsappProcessor],
  exports: [WhatsappProducer],
})
export class WhatsappQueueModule {}
