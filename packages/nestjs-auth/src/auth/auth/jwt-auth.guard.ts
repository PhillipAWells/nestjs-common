import { Injectable, ExecutionContext } from '@nestjs/common';
import { BaseAuthGuard } from '../guards/base-auth.guard.js';

/**
 * JWT authentication guard
 * Uses the 'jwt' strategy to protect routes
 */
@Injectable()
export class JWTAuthGuard extends BaseAuthGuard {
	protected getContext(context: ExecutionContext): any {
		return context.switchToHttp().getRequest();
	}
}
