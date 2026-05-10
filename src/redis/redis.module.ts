import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = 'REDIS';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService): Redis => {
        const url = config.get<string>('redis.url') ?? process.env.REDIS_URL ?? 'redis://localhost:6379';
        return new Redis(url, { maxRetriesPerRequest: null });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
