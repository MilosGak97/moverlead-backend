import { ExecutionContext, Injectable, CanActivate } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.get<boolean>(
      'isPublic',
      context.getHandler(),
    );

    if (isPublic) {
      return true; // Allow unauthenticated access
    }

    // Use await and resolve the value properly
    const result = super.canActivate(context);
    const canActivate =
        result instanceof Observable ? await firstValueFrom(result) : result;

    // Now set userId on request
    if (canActivate) {
      const request = context.switchToHttp().getRequest();
      const user = request.user;

      if (user && user.userId) {
        request.userId = user.userId;
      }
    }
/*
    const canActivate = await super.canActivate(context);



     // Ensure it always returns a boolean or Promise<boolean>
    if (canActivate instanceof Observable) {
      return firstValueFrom(canActivate);
    }


 */
    return canActivate;
  }
}
