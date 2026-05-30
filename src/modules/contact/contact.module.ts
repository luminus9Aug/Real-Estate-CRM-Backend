import { Module } from '@nestjs/common';
import { ContactPublicController } from './contact-public.controller';
import { ContactQueueModule } from '../../queues/contact/contact.queue.module';

@Module({
  imports: [ContactQueueModule],
  controllers: [ContactPublicController],
})
export class ContactModule {}
