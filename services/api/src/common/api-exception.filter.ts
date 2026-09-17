import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiError } from './errors';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{ requestId?: string }>();

    if (exception instanceof ApiError) {
      const body = exception.getResponse() as Record<string, unknown>;
      response.status(exception.getStatus()).json({
        ...body,
        requestId: request.requestId,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const message =
        typeof raw === 'string'
          ? raw
          : Array.isArray((raw as { message?: unknown }).message)
            ? ((raw as { message: string[] }).message.join(', '))
            : ((raw as { message?: string }).message ?? 'Request failed.');
      response.status(status).json({
        code: status === 401 ? 'UNAUTHENTICATED' : 'HTTP_ERROR',
        message,
        requestId: request.requestId,
      });
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'INTERNAL_ERROR',
      message: "CampusOS couldn't complete that request.",
      requestId: request.requestId,
    });
  }
}
