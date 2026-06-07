import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';

import { SubscriptionModule } from '../subscription/subscription.module';
import { UserRepository } from './user.repository';

@Module({
  imports: [SubscriptionModule],
  controllers: [UserController],
  providers: [UserService, UserRepository],
  exports: [UserService, UserRepository],
})
export class UserModule {}
