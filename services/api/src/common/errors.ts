import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }
}

export const Errors = {
  unauthenticated: (message = 'Please sign in to continue.') =>
    new ApiError('UNAUTHENTICATED', message, HttpStatus.UNAUTHORIZED),
  permissionDenied: (message = "You don't have permission to do that.") =>
    new ApiError('PERMISSION_DENIED', message, HttpStatus.FORBIDDEN),
  notFound: (message = 'This item is no longer available.') =>
    new ApiError('NOT_FOUND', message, HttpStatus.NOT_FOUND),
  conflict: (
    message = 'This information changed while you were editing it. Please review the latest version.',
  ) => new ApiError('CONFLICT', message, HttpStatus.CONFLICT),
  rateLimited: (message = 'Too many attempts. Please wait and try again.') =>
    new ApiError('RATE_LIMITED', message, HttpStatus.TOO_MANY_REQUESTS),
  validation: (message: string, details?: Record<string, unknown>) =>
    new ApiError('VALIDATION_ERROR', message, HttpStatus.BAD_REQUEST, details),
};
