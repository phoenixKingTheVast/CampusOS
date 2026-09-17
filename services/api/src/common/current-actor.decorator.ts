import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type Actor = {
  personId: string;
  sessionId: string;
};

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor => {
    const request = ctx.switchToHttp().getRequest<{ actor: Actor }>();
    return request.actor;
  },
);
