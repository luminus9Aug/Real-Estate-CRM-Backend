import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const headerVal = req.headers['x-correlation-id'];
    const id = typeof headerVal === 'string' && headerVal.length > 0 ? headerVal : randomUUID();
    req.headers['x-correlation-id'] = id;
    (req as any).correlationId = id;
    next();
  }
}
