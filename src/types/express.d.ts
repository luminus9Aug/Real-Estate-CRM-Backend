import { AuthUser } from '../modules/auth/types/auth-user.type';

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      correlationId?: string;
      rawBody?: Buffer;
    }
  }
}

