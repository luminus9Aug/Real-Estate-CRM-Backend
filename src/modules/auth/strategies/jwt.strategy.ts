import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AccessTokenPayload } from '../../../types/jwt-payload';
import type { AuthUser } from '../../../modules/auth/types/auth-user.type';
import { UserRole } from '../../../common/constants/roles.constants';
import type Redis from 'ioredis';
import { REDIS } from '../../../redis/redis.module';
import { CACHE_KEYS } from '../../../common/constants/app.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => (req?.cookies?.jwt as string | undefined) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthUser> {
    const start = Date.now();
    try {
      if (payload.jti) {
        const isBlocked = await this.redis.exists(CACHE_KEYS.jwtBlocklist(payload.jti));
        if (isBlocked) {
          throw new UnauthorizedException('Token is revoked');
        }
      }

      const sessionKey = CACHE_KEYS.sessionUser(payload.tenantId ?? 'global', payload.sub);
      const cachedUser = await this.redis.get(sessionKey);
      if (cachedUser) {
        return JSON.parse(cachedUser) as AuthUser;
      }

      const result = await this.fetchAndVerifyUser(payload);
      await this.redis.setex(sessionKey, 900, JSON.stringify(result)); // 15 min TTL
      return result;
    } finally {
      console.log(`[DEBUG] JwtStrategy validate took ${Date.now() - start}ms`);
    }
  }

  private async fetchAndVerifyUser(payload: AccessTokenPayload): Promise<AuthUser> {
    if (payload.role === UserRole.SUPER_ADMIN) {
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          role: UserRole.SUPER_ADMIN,
          isActive: true,
          deletedAt: null,
        },
      });

      if (!user) {
        throw new UnauthorizedException('SuperAdmin user not found or inactive');
      }

      return {
        id: user.id,
        tenantId: null,
        role: user.role as UserRole,
        email: user.email,
        isSuperAdmin: true,
        hasFullDataAccess: true,
      };
    }

    // RLS is handled by TenantPrismaService extensions

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        tenantId: payload.tenantId,
        deletedAt: null,
        isActive: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException();
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role as UserRole,
      email: user.email,
      isSuperAdmin: false,
      hasFullDataAccess: user.hasFullDataAccess,
    };
  }
}
