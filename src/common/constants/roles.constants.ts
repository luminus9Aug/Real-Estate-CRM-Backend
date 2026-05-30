export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export function isSuperAdmin(role: UserRole): boolean {
  return role === UserRole.SUPER_ADMIN;
}

export const ROLE_HIERARCHY = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.OWNER]: 50,
  [UserRole.MANAGER]: 30,
  [UserRole.AGENT]: 10,
  [UserRole.VIEWER]: 5,
} as const;

export function hasHigherOrEqualRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
