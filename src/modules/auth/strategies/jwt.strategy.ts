import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AccessTokenPayload } from '../../../types/jwt-payload';

import type { AuthUser } from '../../../modules/auth/types/auth-user.type';

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
      role: user.role,
      email: user.email,
    };
  }
}
