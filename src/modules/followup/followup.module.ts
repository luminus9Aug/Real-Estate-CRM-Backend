import { Module } from '@nestjs/common';
import { FollowupQueueModule } from '../../queues/followup/followup.queue.module';
import { FollowupController } from './followup.controller';
import { FollowupService } from './followup.service';

@Module({
  imports: [FollowupQueueModule],
  controllers: [FollowupController],
  providers: [FollowupService],
})
export class FollowupModule {}
