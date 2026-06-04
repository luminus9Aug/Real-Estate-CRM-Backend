import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AUTH_EMAIL_QUEUE, AuthEmailProducer } from './auth-email.producer';
import { AuthEmailProcessor } from './auth-email.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: AUTH_EMAIL_QUEUE,
    }),
  ],
  providers: [AuthEmailProducer, AuthEmailProcessor],
  exports: [AuthEmailProducer],
})
export class AuthEmailQueueModule {}
