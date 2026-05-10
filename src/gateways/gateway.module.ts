import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MessageGateway } from './message.gateway';

@Module({
  imports: [ConfigModule, JwtModule.register({})],
  providers: [MessageGateway],
  exports: [MessageGateway],
})
export class GatewayModule {}
