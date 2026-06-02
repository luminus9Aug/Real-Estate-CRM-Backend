import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const started = Date.now();
    this.logger.log(`[START] ${method} ${url} (received at Interceptor)`);
    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - started;
        this.logger.log(`[END] ${method} ${url} completed in ${ms}ms (after controller & interceptor)`);
      }),
    );
  }
}
