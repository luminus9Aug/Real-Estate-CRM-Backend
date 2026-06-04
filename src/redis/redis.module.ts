import { Global, Module, OnApplicationShutdown, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { QuotaCounterService } from '../common/utils/quota-counter.service';
import { REDIS, BULL_REDIS } from './redis.constants';

export { REDIS, BULL_REDIS };

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ConfigService): Redis => {
        const url = (process.env.REDIS_URL || config.get<string>('redis.url') || 'redis://127.0.0.1:6379').replace('localhost', '127.0.0.1');
        const client = new Redis(url, { maxRetriesPerRequest: null });
        client.on('error', (err) => console.error('[Redis Error - REDIS]', err.message));
        return client;
      },
      inject: [ConfigService],
    },
    {
      provide: BULL_REDIS,
      useFactory: (config: ConfigService): Redis => {
        const url = (process.env.REDIS_URL || config.get<string>('redis.url') || 'redis://127.0.0.1:6379').replace('localhost', '127.0.0.1');
        const client = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
        client.on('error', (err) => console.error('[Redis Error - BULL_REDIS]', err.message));
        return client;
      },
      inject: [ConfigService],
    },
    QuotaCounterService,
  ],
  exports: [REDIS, BULL_REDIS, QuotaCounterService],
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
