import type { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: UserRole;
  email: string;
}
