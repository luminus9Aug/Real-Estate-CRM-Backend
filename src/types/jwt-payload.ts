import type { UserRole } from '@prisma/client';

export interface AccessTokenPayload {
  sub: string;
  tenantId: string | null;
  role: UserRole;
  email: string;
}
