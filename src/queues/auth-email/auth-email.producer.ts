import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import type { AuthEmailJobPayload } from './auth-email-job.interface';

export const AUTH_EMAIL_QUEUE = 'auth-email';

@Injectable()
export class AuthEmailProducer {
  constructor(@InjectQueue(AUTH_EMAIL_QUEUE) private readonly queue: Queue) {}

  async enqueueOtp(payload: AuthEmailJobPayload): Promise<void> {
    await this.queue.add('send_otp_email', payload, {
      removeOnComplete: true,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });
  }
}
