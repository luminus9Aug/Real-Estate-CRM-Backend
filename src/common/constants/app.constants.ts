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
  dashboardStats: (tenantId: string) => `tenant:${tenantId}:dashboard:stats`,
  leadsList: (tenantId: string, hash: string, agentId?: string) => agentId ? `tenant:${tenantId}:leads:list:agent:${agentId}:${hash}` : `tenant:${tenantId}:leads:list:all:${hash}`,
  lead: (tenantId: string, leadId: string) => `tenant:${tenantId}:lead:${leadId}`,
  commissionPending: (tenantId: string) => `tenant:${tenantId}:commission:pending`,
  user: (tenantId: string, userId: string) => `tenant:${tenantId}:user:${userId}`,
  features: (tenantId: string) => `tenant:${tenantId}:features`,
  tenantSub: (tenantId: string) => `tenant:${tenantId}:sub`,
  sessionUser: (tenantId: string, userId: string) => `tenant:${tenantId}:session:${userId}`,
  jwtBlocklist: (jti: string) => `global:jwt:blocklist:${jti}`,
  dashboardCharts: (tenantId: string) => `tenant:${tenantId}:dashboard:charts`,
  dashboardActivity: (tenantId: string) => `tenant:${tenantId}:dashboard:activity`,
  dashboardTeamPerformance: (tenantId: string) => `tenant:${tenantId}:dashboard:teamPerf`,
  reportTeamCommission: (tenantId: string) => `tenant:${tenantId}:report:commission`,
  reportAgentPerformance: (tenantId: string) => `tenant:${tenantId}:report:agentPerf`,
  otpCode: (email: string, subdomain: string) => `global:otp:${subdomain}:${email}`,
  resetSession: (token: string) => `global:reset:session:${token}`,
} as const;

