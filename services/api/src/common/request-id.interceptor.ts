import { randomUUID } from 'crypto';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; requestId?: string }>();
    const headerId = request.headers['x-request-id'];
    request.requestId = headerId || randomUUID();
    const response = context.switchToHttp().getResponse<{ setHeader: (k: string, v: string) => void }>();
    response.setHeader('x-request-id', request.requestId);
    return next.handle();
  }
}
