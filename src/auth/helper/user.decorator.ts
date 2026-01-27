// src/auth/user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const User = createParamDecorator(
  (data: 'userId' | null = null, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // populated by authguard
    const user = request.user;
    if (!user) return null;

    // extract userId for backend check in product and user unique case
    return data === 'userId' ? user.userId : user;
  },
);
