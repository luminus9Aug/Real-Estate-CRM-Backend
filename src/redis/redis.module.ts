import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS = 'REDIS';
export const BULL_REDIS = 'BULL_REDIS';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService): Redis => {
        const url = (process.env.REDIS_URL || config.get<string>('redis.url') || 'redis://127.0.0.1:6379').replace('localhost', '127.0.0.1');
        return new Redis(url, { maxRetriesPerRequest: null });
      },
      inject: [ConfigService],
    },
    {
      provide: BULL_REDIS,
      useFactory: (config: ConfigService): Redis => {
        const url = (process.env.REDIS_URL || config.get<string>('redis.url') || 'redis://127.0.0.1:6379').replace('localhost', '127.0.0.1');
        return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS, BULL_REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(BULL_REDIS) private readonly bullRedis: Redis,
  ) {}

  async onApplicationShutdown() {
    await Promise.all([
      this.redis.quit().catch(() => {}),
      this.bullRedis.quit().catch(() => {}),
    ]);
  }
}
