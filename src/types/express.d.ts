declare namespace Express {
  interface User {
    id: string;
    tenantId: string;
    role: import('@prisma/client').UserRole;
    email: string;
  }
  interface Request {
    correlationId?: string;
  }
}
