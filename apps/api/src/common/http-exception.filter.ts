import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface RequestWithId extends Request {
  requestId?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithId>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const requestId = request.requestId ?? 'unknown';
    const path = request.originalUrl.split('?')[0];

    let message: string | string[] = 'Erro interno do servidor';
    if (exception instanceof HttpException) {
      const body = exception.getResponse();
      if (typeof body === 'string') message = body;
      else if (body && typeof body === 'object' && 'message' in body) {
        const candidate = body.message;
        if (typeof candidate === 'string' || Array.isArray(candidate)) message = candidate as string | string[];
      }
    }

    const log = JSON.stringify({
      event: 'http.request.failed',
      requestId,
      method: request.method,
      path,
      status,
    });
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(log, exception instanceof Error ? exception.stack : undefined);
    else this.logger.warn(log);

    response.status(status).json({
      statusCode: status,
      message,
      requestId,
      path,
      timestamp: new Date().toISOString(),
    });
  }
}
