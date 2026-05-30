/** Lowercase Prisma `$extends` model names (see Prisma client delegate casing). */
export const TENANT_SCOPED_MODELS = [
  'lead',
  'property',
  'user',
  'message',
  'activity',
  'followup',
  'offer',
  'blog',
  'propertyview',
  'brochurelink',
  'commissiontransaction',
  'subscription',
  'invoice',
  'auditlog',
] as const;

export const CACHE_KEYS = {
  dashboardStats: (tenantId: string) => `dashboard:stats:${tenantId}`,
  leadsList: (tenantId: string, hash: string) => `leads:list:${tenantId}:${hash}`,
  lead: (tenantId: string, leadId: string) => `lead:${tenantId}:${leadId}`,
  commissionPending: (tenantId: string) => `commission:pending:${tenantId}`,
  user: (tenantId: string, userId: string) => `user:${tenantId}:${userId}`,
  features: (tenantId: string) => `features:${tenantId}`,
} as const;
