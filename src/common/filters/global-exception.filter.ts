import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const corrId = req.correlationId ?? 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const r = exception.getResponse();
      message = typeof r === 'string' ? r : this.extractMessage(r);
      error = typeof r === 'object' && r !== null && 'error' in r ? String((r as { error: string }).error) : error;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          message = 'Record already exists';
          error = 'Conflict';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          error = 'Not Found';
          break;
        case 'P2003':
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid foreign key';
          error = 'Bad Request';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Database error';
          error = 'Internal Server Error';
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided';
      error = 'Bad Request';
    }

    this.logger.error(`[${corrId}] ${status} ${req.method} ${req.url} — ${message}`, {
      exception: exception instanceof Error ? exception.stack : exception,
    });

    res.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: req.url,
      correlationId: corrId,
    });
  }

  private extractMessage(r: string | object): string {
    if (typeof r === 'string') return r;
    if ('message' in r && Array.isArray((r as { message: string[] }).message)) {
      return (r as { message: string[] }).message.join(', ');
    }
    if ('message' in r) return String((r as { message: unknown }).message);
    return 'Error';
  }
}
