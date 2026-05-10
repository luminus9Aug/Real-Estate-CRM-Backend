import { BadRequestException } from '@nestjs/common';
import { CommissionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CommissionService } from '../../src/modules/commission/commission.service';
import type { MessageGateway } from '../../src/gateways/message.gateway';
import type { TenantPrismaService } from '../../src/common/utils/tenant-prisma.service';
import type Redis from 'ioredis';

describe('CommissionService.calculateCommission', () => {
  const noopRedis = { del: jest.fn() } as unknown as Redis;
  const noopGateway = {} as MessageGateway;
  const noopTenantPrisma = {} as TenantPrismaService;

  const service = new CommissionService(noopTenantPrisma, noopRedis, noopGateway);

  const percentAgent = (rate: string | null) => ({
    id: 'a1',
    commissionType: CommissionType.PERCENT,
    commissionRate: rate === null ? null : new Decimal(rate),
    fixedCommissionAmount: null,
  });

  it('calculates PERCENT commission (2.5% of 1000000 = 25000)', () => {
    const amount = service.calculateCommission(percentAgent('2.5'), 1_000_000);
    expect(amount.toString()).toBe('25000');
  });

  it('calculates FIXED commission correctly', () => {
    const amount = service.calculateCommission(
      {
        id: 'a2',
        commissionType: CommissionType.FIXED,
        commissionRate: new Decimal(0),
        fixedCommissionAmount: new Decimal('15000.50'),
      },
      1_000_000,
    );
    expect(amount.toString()).toBe('15000.5');
  });

  it('throws when saleValue is 0', () => {
    expect(() => service.calculateCommission(percentAgent('2'), 0)).toThrow(BadRequestException);
  });

  it('throws when saleValue is negative', () => {
    expect(() => service.calculateCommission(percentAgent('2'), -1)).toThrow(BadRequestException);
  });

  it('throws when commissionRate is null for PERCENT type', () => {
    expect(() => service.calculateCommission(percentAgent(null), 100)).toThrow(BadRequestException);
  });

  it('throws when fixedCommissionAmount is null for FIXED type', () => {
    expect(() =>
      service.calculateCommission(
        {
          id: 'a3',
          commissionType: CommissionType.FIXED,
          commissionRate: null,
          fixedCommissionAmount: null,
        },
        100,
      ),
    ).toThrow(BadRequestException);
  });

  it('throws when commissionRate > 100', () => {
    expect(() => service.calculateCommission(percentAgent('101'), 100)).toThrow(BadRequestException);
  });

  it('throws when commissionType is invalid (no branch)', () => {
    const invalidType = 'INVALID' as unknown as CommissionType;
    expect(() =>
      service.calculateCommission(
        {
          id: 'a4',
          commissionType: invalidType,
          commissionRate: new Decimal(1),
          fixedCommissionAmount: null,
        },
        100,
      ),
    ).toThrow(BadRequestException);
  });
});
