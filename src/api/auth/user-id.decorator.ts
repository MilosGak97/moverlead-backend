/*import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
   // return request.userId;
      //return request.userId || request.user?.userId; // fallback from JwtStrategy
      return request.user.id || request.id; // fallback from JwtStrategy
  },
);
*/

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request?.user?.id ?? null; // clean and safe
    },
);