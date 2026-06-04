import { BullModule } from '@nestjs/bullmq';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';
import { I18nModule, HeaderResolver } from 'nestjs-i18n';
import IORedis from 'ioredis';
import { existsSync } from 'fs';
import { join } from 'path';
import { redisStore } from 'cache-manager-redis-yet';

import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';
import { cloudinaryConfig } from './config/cloudinary.config';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { redisConfig } from './config/redis.config';
import { whatsappConfig } from './config/whatsapp.config';

import { GatewayModule } from './gateways/gateway.module';
import { AuthModule } from './modules/auth/auth.module';
import { CommissionModule } from './modules/commission/commission.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { FollowupModule } from './modules/followup/followup.module';
import { HealthModule } from './modules/health/health.module';
import { LeadModule } from './modules/lead/lead.module';
import { MessageModule } from './modules/message/message.module';
import { PropertyModule } from './modules/property/property.module';
import { ReportModule } from './modules/report/report.module';
import { UserModule } from './modules/user/user.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { AdminModule } from './modules/admin/admin.module';
import { PlanModule } from './modules/plan/plan.module';
import { AuditModule } from './modules/audit/audit.module';
import { BillingModule } from './modules/billing/billing.module';
import { BlogModule } from './modules/blog/blog.module';
import { ContactModule } from './modules/contact/contact.module';

import { PrismaModule } from './prisma/prisma.module';
import { FollowupQueueModule } from './queues/followup/followup.queue.module';
import { WhatsappQueueModule } from './queues/whatsapp/whatsapp.queue.module';
import { AuthEmailQueueModule } from './queues/auth-email/auth-email.queue.module';
import { RedisModule, BULL_REDIS } from './redis/redis.module';
import { TenantPrismaModule } from './tenant-prisma/tenant-prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { SubscriptionActiveGuard } from './common/guards/subscription-active.guard';
import { RolesGuard } from './common/guards/roles.guard';

import { billingConfig } from './config/billing.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development.local', '.env.development', '.env.local', '.env'],
      load: [databaseConfig, redisConfig, jwtConfig, whatsappConfig, cloudinaryConfig, billingConfig],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
    ScheduleModule.forRoot(),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          url: process.env.REDIS_URL || config.get<string>('redis.url'),
          ttl: 300,
        }),
      }),
    }),
    BullModule.forRootAsync({
      imports: [RedisModule],
      inject: [BULL_REDIS],
      useFactory: (bullRedis: IORedis) => ({
        connection: bullRedis,
      }),
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: existsSync(join(__dirname, 'i18n')) ? join(__dirname, 'i18n') : join(__dirname, '..', 'i18n'),
        watch: process.env.NODE_ENV !== 'production',
      },
      resolvers: [new HeaderResolver(['x-lang'])],
    }),
    PrismaModule,
    RedisModule,
    TenantPrismaModule,
    GatewayModule,
    WhatsappQueueModule,
    FollowupQueueModule,
    AuthEmailQueueModule,
    HealthModule,
    AuthModule,
    UserModule,
    LeadModule,
    PropertyModule,
    MessageModule,
    CommissionModule,
    DashboardModule,
    FollowupModule,
    ReportModule,
    SubscriptionModule,
    AdminModule,
    PlanModule,
    AuditModule,
    BillingModule,
    BlogModule,
    ContactModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SubscriptionActiveGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware, TenantContextMiddleware)
      .forRoutes('*');
  }
}
