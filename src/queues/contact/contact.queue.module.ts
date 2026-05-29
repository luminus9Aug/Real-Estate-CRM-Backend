import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CONTACT_QUEUE, ContactProducer } from './contact.producer';
import { ContactProcessor } from './contact.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CONTACT_QUEUE,
    }),
  ],
  providers: [ContactProducer, ContactProcessor],
  exports: [ContactProducer],
})
export class ContactQueueModule {}
