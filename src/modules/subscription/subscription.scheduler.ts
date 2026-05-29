import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionScheduler {
  private readonly logger = new Logger(SubscriptionScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleTrialExpiryCheck() {
    this.logger.log('Running trial expiry check...');

    const expiredTrials = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.TRIAL,
        trialEndsAt: {
          lte: new Date(),
        },
      },
    });

    this.logger.log(`Found ${expiredTrials.length} expired trials`);

    for (const tenant of expiredTrials) {
      try {
        await this.prisma.$transaction([
          this.prisma.tenant.update({
            where: { id: tenant.id },
            data: {
              subscriptionStatus: SubscriptionStatus.SUSPENDED,
            },
          }),
          this.prisma.subscription.updateMany({
            where: {
              tenantId: tenant.id,
              status: SubscriptionStatus.TRIAL,
            },
            data: {
              status: SubscriptionStatus.SUSPENDED,
            },
          }),
        ]);

        this.logger.log(`Suspended tenant ${tenant.id} (trial expired)`);
      } catch (error) {
        this.logger.error(`Failed to suspend tenant ${tenant.id}:`, error);
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDataCleanup() {
    this.logger.log('Running data cleanup for cancelled tenants...');

    const tenantsToArchive = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
        dataRetentionUntil: {
          lte: new Date(),
        },
        archivedAt: null,
      },
    });

    this.logger.log(`Found ${tenantsToArchive.length} tenants to archive`);

    for (const tenant of tenantsToArchive) {
      try {
        await this.archiveTenant(tenant.id);
        this.logger.log(`Archived tenant ${tenant.id}`);
      } catch (error) {
        this.logger.error(`Failed to archive tenant ${tenant.id}:`, error);
      }
    }
  }

  private async archiveTenant(tenantId: string) {
    await this.prisma.$transaction([
      this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          archivedAt: new Date(),
          name: 'Deleted Tenant',
          email: null,
          phone: null,
        },
      }),
      // Soft-delete related data or hard-delete as per retention policy
      this.prisma.lead.updateMany({ where: { tenantId }, data: { deletedAt: new Date() } }),
      this.prisma.property.updateMany({ where: { tenantId }, data: { deletedAt: new Date() } }),
    ]);
  }
}
