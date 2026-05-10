import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { SupportedLanguage, UserRole } from '@prisma/client';
import { AuthService } from '../../src/modules/auth/auth.service';
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockJwt: any;
  let mockConfig: any;
  let mockRes: any;

  beforeEach(() => {
    mockPrisma = {
      tenant: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
      $executeRaw: jest.fn(),
    };
    mockJwt = {
      sign: jest.fn(() => 'token'),
      verify: jest.fn(() => ({ sub: 'u1', tenantId: 't1' })),
    };
    mockConfig = {
      getOrThrow: jest.fn((key) => {
        if (key === 'jwt.secret') return 'access-secret';
        if (key === 'jwt.refreshSecret') return 'refresh-secret';
        if (key === 'jwt.wsSecret') return 'ws-secret';
        return 'value';
      }),
    };
    mockRes = {
      cookie: jest.fn(),
      clearCookie: jest.fn(),
    };

    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
    );
  });

  describe('signup', () => {
    it('should throw ConflictException if subdomain taken', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
      await expect(service.signup({ subdomain: 'taken' } as any, mockRes)).rejects.toThrow(ConflictException);
    });

    it('should create tenant and user and set cookies', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      mockPrisma.tenant.create.mockResolvedValue({ id: 't1' });
      mockPrisma.user.create.mockResolvedValue({ id: 'u1', tenantId: 't1', role: UserRole.OWNER, email: 'test@test.com' });

      const result = await service.signup({
        subdomain: 'new',
        tenantName: 'Tenant',
        ownerEmail: 'test@test.com',
        ownerName: 'Owner',
        password: 'password',
      }, mockRes);

      expect(result.wsToken).toBe('token');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException if tenant not found', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue(null);
      await expect(service.login({ subdomain: 'wrong' } as any, mockRes)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if invalid credentials', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(service.login({ subdomain: 't1', email: 'e', password: 'p' } as any, mockRes)).rejects.toThrow(UnauthorizedException);
    });

    it('should login and set cookies', async () => {
      mockPrisma.tenant.findUnique.mockResolvedValue({ id: 't1' });
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', tenantId: 't1', role: UserRole.AGENT, email: 'e', passwordHash: 'hash', isActive: true });
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const result = await service.login({ subdomain: 't1', email: 'e', password: 'p' } as any, mockRes);
      expect(result.wsToken).toBe('token');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('should throw UnauthorizedException if no token', async () => {
      await expect(service.refresh(mockRes, undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('should refresh tokens if valid', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'u1', tenantId: 't1', role: UserRole.AGENT, email: 'e', isActive: true });
      const result = await service.refresh(mockRes, 'valid-token');
      expect(result.wsToken).toBe('token');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
    });
  });

  describe('me', () => {
    it('should return stripped user', async () => {
      const mockUser = { id: 'u1', tenantId: 't1', name: 'User', passwordHash: 'secret' };
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.me('u1', 't1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.name).toBe('User');
    });
  });
});
