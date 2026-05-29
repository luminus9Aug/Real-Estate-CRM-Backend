import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AccessTokenPayload } from '../../../types/jwt-payload';
import type { AuthUser } from '../../../modules/auth/types/auth-user.type';
import { UserRole } from '../../../common/constants/roles.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
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
    // SuperAdmins bypass tenant-level filtering
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
      };
    }

    // Set RLS session for standard users
    await this.prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${payload.tenantId}::text, false)`;

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
    };
  }
}
