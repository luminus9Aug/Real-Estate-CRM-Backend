import { BullModule } from '@nestjs/bullmq';
import { Module, NestModule, MiddlewareConsumer, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { I18nModule, HeaderResolver } from 'nestjs-i18n';
import IORedis from 'ioredis';
import { existsSync } from 'fs';
import { join } from 'path';
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
import { PrismaModule } from './prisma/prisma.module';
import { FollowupQueueModule } from './queues/followup/followup.queue.module';
import { WhatsappQueueModule } from './queues/whatsapp/whatsapp.queue.module';
import { RedisModule, BULL_REDIS } from './redis/redis.module';
import { TenantPrismaModule } from './tenant-prisma/tenant-prisma.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}.local`,
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env.local',
        '.env',
      ],
      load: [databaseConfig, redisConfig, jwtConfig, whatsappConfig, cloudinaryConfig],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }]),
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
