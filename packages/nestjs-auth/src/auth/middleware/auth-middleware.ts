import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppLogger } from '@pawells/nestjs-shared/common';

/**
 * Token extraction strategy interface
 */
export interface TokenExtractionStrategy {
	extract(context: ExecutionContext): string | null;
}

/**
 * Auth validation strategy interface
 */
export interface AuthValidationStrategy {
	validate(token: string, context: ExecutionContext): Promise<any>;
}

/**
 * Error handling strategy interface
 */
export interface AuthErrorHandlingStrategy {
	handleError(error: any, context: ExecutionContext): void;
}

/**
 * HTTP Header token extraction strategy
 */
@Injectable()
export class HeaderTokenExtractionStrategy implements TokenExtractionStrategy {
	public extract(_context: ExecutionContext): string | null {
		const request = _context.switchToHttp().getRequest();
		const authHeader = request.headers?.authorization ?? request.headers?.Authorization;

		if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
			return authHeader.substring(7); // Remove "Bearer " prefix
		}

		return null;
	}
}

/**
 * GraphQL Context token extraction strategy
 */
@Injectable()
export class GraphQLTokenExtractionStrategy implements TokenExtractionStrategy {
	public extract(_context: ExecutionContext): string | null {
		try {
			// Try to get from GraphQL context
			const gqlContext = (_context as any).getContext?.();
			if (gqlContext) {
				const authHeader = gqlContext.req?.headers?.authorization ??
					gqlContext.req?.headers?.Authorization;

				if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
					return authHeader.substring(7); // Remove "Bearer " prefix
				}

				// Try alternative locations in GraphQL context
				return gqlContext.token ?? gqlContext.authorization;
			}
		}
		catch {
			// Not a GraphQL context
		}

		return null;
	}
}

/**
 * JWT token validation strategy
 */
@Injectable()
export class JWTTokenValidationStrategy implements AuthValidationStrategy {
	constructor(
		private readonly jwtService: JwtService,
		private readonly logger: AppLogger
	) {}

	public async validate(token: string, _context: ExecutionContext): Promise<any> {
		try {
			const payload = await this.jwtService.verifyAsync(token);
			this.logger.debug('JWT token validated successfully');
			return payload;
		}
		catch (error) {
			this.logger.warn(`JWT token validation failed: ${error instanceof Error ? error.message : String(error)}`);
			throw new UnauthorizedException('Invalid or expired token');
		}
	}
}

/**
 * Default error handling strategy
 */
@Injectable()
export class DefaultAuthErrorHandlingStrategy implements AuthErrorHandlingStrategy {
	public handleError(error: any, _context: ExecutionContext): void {
		if (error instanceof UnauthorizedException) {
			throw error;
		}

		throw new UnauthorizedException('Authentication failed');
	}
}

/**
 * Configuration for auth middleware
 */
export interface AuthMiddlewareConfig {
	/** Token extraction strategy */
	tokenExtractionStrategy?: TokenExtractionStrategy;

	/** Auth validation strategy */
	authValidationStrategy?: AuthValidationStrategy;

	/** Error handling strategy */
	errorHandlingStrategy?: AuthErrorHandlingStrategy;

	/** Whether authentication is required (default: true) */
	required?: boolean;

	/** Roles required for access */
	roles?: string[];

	/** Permissions required for access */
	permissions?: string[];

	/** Custom validation function */
	customValidator?: (payload: any, context: ExecutionContext) => boolean | Promise<boolean>;
}

/**
 * Base Auth Guard with strategy pattern
 *
 * Provides a flexible authentication system that can be configured with different
 * token extraction, validation, and error handling strategies.
 */
@Injectable()
export class BaseAuthGuard implements CanActivate {
	private readonly logger: AppLogger;

	constructor(
		private readonly jwtService: JwtService,
		@Inject(AppLogger) appLogger: AppLogger,
		private readonly config: AuthMiddlewareConfig
	) {
		this.logger = appLogger.createContextualLogger(BaseAuthGuard.name);
	}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		try {
			// Check if authentication is required for this route/resolver
			const isAuthRequired = this.config.required ?? true;
			if (!isAuthRequired) {
				return true;
			}

			// Extract token
			const token = this.extractToken(context);
			if (!token) {
				this.logger.debug('No token found in request');
				this.handleAuthError(new UnauthorizedException('No token provided'), context);
			}

			// Validate token
			const payload = await this.validateToken(token!, context);

			// Store user in request context
			this.setUserInContext(context, payload);

			// Check roles/permissions if specified
			if (this.config.roles || this.config.permissions) {
				await this.checkRolesAndPermissions(payload, context);
			}

			// Run custom validation if provided
			if (this.config.customValidator) {
				const isValid = await this.config.customValidator(payload, context);
				if (!isValid) {
					this.handleAuthError(new UnauthorizedException('Custom validation failed'), context);
				}
			}

			return true;
		}
		catch (error) {
			this.handleAuthError(error, context);
		}
	}

	/**
	 * Extract token using configured strategy
	 */
	private extractToken(context: ExecutionContext): string | null {
		const strategy = this.config.tokenExtractionStrategy ?? this.getDefaultTokenExtractionStrategy(context);
		return strategy.extract(context);
	}

	/**
	 * Get default token extraction strategy based on context
	 */
	private getDefaultTokenExtractionStrategy(context: ExecutionContext): TokenExtractionStrategy {
		try {
			// Try GraphQL context
			(context as any).getContext?.();
			return new GraphQLTokenExtractionStrategy();
		}
		catch {
			// Fall back to HTTP
			return new HeaderTokenExtractionStrategy();
		}
	}

	/**
	 * Validate token using configured strategy
	 */
	private async validateToken(token: string, context: ExecutionContext): Promise<any> {
		const strategy = this.config.authValidationStrategy ?? new JWTTokenValidationStrategy(this.jwtService, this.logger);
		return strategy.validate(token, context);
	}

	/**
	 * Handle authentication errors using configured strategy
	 */
	private handleAuthError(error: any, _context: ExecutionContext): never {
		const strategy = this.config.errorHandlingStrategy ?? new DefaultAuthErrorHandlingStrategy();
		strategy.handleError(error, _context);
		// This should never be reached as handleError throws
		throw error;
	}

	/**
	 * Set user payload in request context
	 */
	private setUserInContext(context: ExecutionContext, payload: any): void {
		try {
			// Try HTTP context first
			const request = context.switchToHttp().getRequest();
			request.user = payload;
		}
		catch {
			// Try GraphQL context
			try {
				const gqlContext = (context as any).getContext?.();
				if (gqlContext) {
					gqlContext.user = payload;
				}
			}
			catch {
				this.logger.warn('Could not set user in context - unsupported context type');
			}
		}
	}

	/**
	 * Check roles and permissions
	 */
	private async checkRolesAndPermissions(payload: any, _context: ExecutionContext): Promise<void> {
		const userRoles = payload.roles ?? [];
		const userPermissions = payload.permissions ?? [];

		// Check roles
		if (this.config.roles) {
			const hasRequiredRole = this.config.roles.some(role => userRoles.includes(role));
			if (!hasRequiredRole) {
				throw new UnauthorizedException(`Required roles: ${this.config.roles.join(', ')}`);
			}
		}

		// Check permissions
		if (this.config.permissions) {
			const hasRequiredPermission = this.config.permissions.some(permission =>
				userPermissions.includes(permission)
			);
			if (!hasRequiredPermission) {
				throw new UnauthorizedException(`Required permissions: ${this.config.permissions.join(', ')}`);
			}
		}
	}
}

/**
 * Factory for creating auth middleware configurations
 */
export class AuthMiddlewareFactory {
	/**
	 * Create JWT-based auth configuration
	 */
	public static createJWTAuth(config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: true,
			...config
		};
	}

	/**
	 * Create optional auth configuration (authentication not required)
	 */
	public static createOptionalAuth(config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: false,
			...config
		};
	}

	/**
	 * Create role-based auth configuration
	 */
	public static createRoleBasedAuth(roles: string[], config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: true,
			roles,
			...config
		};
	}

	/**
	 * Create permission-based auth configuration
	 */
	public static createPermissionBasedAuth(permissions: string[], config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: true,
			permissions,
			...config
		};
	}

	/**
	 * Create custom auth configuration
	 */
	public static createCustomAuth(
		customValidator: (payload: any, context: ExecutionContext) => boolean | Promise<boolean>,
		config: Partial<AuthMiddlewareConfig> = {}
	): AuthMiddlewareConfig {
		return {
			required: true,
			customValidator,
			...config
		};
	}
}
