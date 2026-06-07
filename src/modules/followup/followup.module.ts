import { Module } from '@nestjs/common';
import { FollowupQueueModule } from '../../queues/followup/followup.queue.module';
import { FollowupController } from './followup.controller';
import { FollowupService } from './followup.service';

import { FollowUpRepository } from './followup.repository';
import { LeadRepository } from '../lead/lead.repository';

@Module({
  imports: [FollowupQueueModule],
  controllers: [FollowupController],
  providers: [FollowupService, FollowUpRepository, LeadRepository],
})
export class FollowupModule {}
