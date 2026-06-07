import type { UserRole } from '@prisma/client';

export interface AuthUser {
  id: string;
  tenantId: string | null;
  role: UserRole;
  email: string;
  isSuperAdmin?: boolean;
  hasFullDataAccess: boolean;
}
