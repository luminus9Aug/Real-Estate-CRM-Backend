import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeadStatus, UserRole, CommissionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { LeadService } from '../../src/modules/lead/lead.service';
import type { TenantPrismaService } from '../../src/common/utils/tenant-prisma.service';
import type { MessageGateway } from '../../src/gateways/message.gateway';
import { I18nService } from 'nestjs-i18n';
import type Redis from 'ioredis';
import { QuotaCounterService } from '../../src/common/utils/quota-counter.service';

describe('LeadService', () => {
  let service: LeadService;
  let mockTenantPrisma: any;
  let mockRedis: any;
  let mockGateway: any;
  let mockI18n: any;
  let mockQuotaCounter: any;

  beforeEach(() => {
    mockTenantPrisma = {
      client: {
        lead: {
          findMany: jest.fn(),
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        user: {
          findFirst: jest.fn(),
        },
        property: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockTenantPrisma.client)),
        commissionTransaction: {
          create: jest.fn(),
        },
        activity: {
          create: jest.fn(),
        },
      },
    };
    mockRedis = {
      del: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
    };
    mockGateway = {
      emitLeadAssigned: jest.fn(),
    };
    mockI18n = {
      t: jest.fn((key) => key),
    };
    mockQuotaCounter = {
      increment: jest.fn(),
      decrement: jest.fn(),
      getCount: jest.fn(),
      initFromDb: jest.fn(),
    };

    service = new LeadService(
      mockTenantPrisma as unknown as TenantPrismaService,
      mockRedis as unknown as Redis,
      mockGateway as unknown as MessageGateway,
      mockI18n as unknown as I18nService,
      mockQuotaCounter as unknown as QuotaCounterService,
    );
  });

  describe('list', () => {
    it('should return list of leads and nextCursor', async () => {
      const mockLeads = [{ id: 'l1' }, { id: 'l2' }];
      mockTenantPrisma.client.lead.findMany.mockResolvedValue(mockLeads);

      const result = await service.list('t1', { limit: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBe('l1');
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if lead not found', async () => {
      mockTenantPrisma.client.lead.findUnique.mockResolvedValue(null);
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue(null);
      await expect(service.findOne('l1')).rejects.toThrow(NotFoundException);
    });

    it('should return lead if found', async () => {
      const mockLead = { id: 'l1', tenantId: 't1' };
      mockTenantPrisma.client.lead.findUnique.mockResolvedValue(mockLead);
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      const result = await service.findOne('l1');
      expect(result).toBe(mockLead);
    });
  });

  describe('create', () => {
    it('should create a lead and invalidate cache', async () => {
      const dto = { name: 'Test Lead', phone: '123' };
      mockTenantPrisma.client.lead.create.mockResolvedValue({ id: 'l1', ...dto });

      const result = await service.create('t1', 'u1', dto as any);
      expect(result).toBeDefined();
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('should throw NotFoundException if lead not found', async () => {
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue(null);
      await expect(service.softDelete('l1', 't1')).rejects.toThrow(NotFoundException);
    });

    it('should mark lead as deleted', async () => {
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue({ id: 'l1' });
      mockTenantPrisma.client.lead.update.mockResolvedValue({ id: 'l1', deletedAt: new Date() });

      await service.softDelete('l1', 't1');
      expect(mockTenantPrisma.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });
  });

  describe('assign', () => {
    it('should throw BadRequestException if agent not found or invalid role', async () => {
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue({ id: 'l1' });
      mockTenantPrisma.client.user.findFirst.mockResolvedValue(null);

      await expect(service.assign('l1', 't1', { agentId: 'a1' })).rejects.toThrow(BadRequestException);
    });

    it('should assign lead and emit event', async () => {
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue({ id: 'l1' });
      mockTenantPrisma.client.user.findFirst.mockResolvedValue({ id: 'a1', name: 'Agent' });
      mockTenantPrisma.client.lead.update.mockResolvedValue({ id: 'l1', assignedToId: 'a1' });

      await service.assign('l1', 't1', { agentId: 'a1' });
      expect(mockGateway.emitLeadAssigned).toHaveBeenCalled();
    });
  });

  describe('closeLead', () => {
    it('should throw ForbiddenException if closer is AGENT', async () => {
      await expect(
        service.closeLead('l1', 't1', {} as any, 'u1', UserRole.AGENT),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if no agent assigned', async () => {
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue({
        id: 'l1',
        assignedTo: null,
      });
      await expect(
        service.closeLead('l1', 't1', { closedPropertyId: 'p1', finalSaleValue: 100 }, 'u1', UserRole.OWNER),
      ).rejects.toThrow(BadRequestException);
    });

    it('should close lead and create commission', async () => {
      const mockLead = {
        id: 'l1',
        assignedToId: 'a1',
        assignedTo: {
          id: 'a1',
          commissionType: CommissionType.PERCENT,
          commissionRate: new Decimal('2.5'),
        },
        tenant: { currency: 'INR' },
      };
      mockTenantPrisma.client.lead.findFirst.mockResolvedValue(mockLead);
      mockTenantPrisma.client.property.findFirst.mockResolvedValue({ id: 'p1' });

      await service.closeLead(
        'l1',
        't1',
        { closedPropertyId: 'p1', finalSaleValue: 1000000 },
        'u1',
        UserRole.OWNER,
      );

      expect(mockTenantPrisma.client.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: LeadStatus.CONVERTED }),
        }),
      );
      expect(mockTenantPrisma.client.commissionTransaction.create).toHaveBeenCalled();
    });
  });
});
