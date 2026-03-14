import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { ModuleRef } from '@nestjs/core';
import { AppLogger } from '@pawells/nestjs-shared/common';
import type { LazyModuleRefService } from '@pawells/nestjs-shared/common';

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
	public extract(context: ExecutionContext): string | null {
		const request = context.switchToHttp().getRequest();
		const authHeader = request.headers?.authorization ?? request.headers?.Authorization;
		const BEARER_PREFIX = 'Bearer ';

		if (authHeader && typeof authHeader === 'string' && authHeader.startsWith(BEARER_PREFIX)) {
			return authHeader.substring(BEARER_PREFIX.length);
		}

		return null;
	}
}

/**
 * GraphQL Context token extraction strategy
 */
@Injectable()
export class GraphQLTokenExtractionStrategy implements TokenExtractionStrategy {
	public extract(context: ExecutionContext): string | null {
		try {
			// Try to get from GraphQL context
			const gqlContext = (context as any).getContext?.();
			if (gqlContext) {
				const authHeader = gqlContext.req?.headers?.authorization ??
					gqlContext.req?.headers?.Authorization;
				const BEARER_PREFIX = 'Bearer ';

				if (authHeader && typeof authHeader === 'string' && authHeader.startsWith(BEARER_PREFIX)) {
					return authHeader.substring(BEARER_PREFIX.length);
				}

				// Try alternative locations in GraphQL context
				return gqlContext.token ?? gqlContext.authorization;
			}
		} catch {
			// Not a GraphQL context
		}

		return null;
	}
}

/**
 * JWT token validation strategy
 */
@Injectable()
export class JWTTokenValidationStrategy implements AuthValidationStrategy, LazyModuleRefService {
	private _logger: AppLogger | undefined;

	public get JwtService(): JwtService {
		return this.Module.get(JwtService);
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	private get logger(): AppLogger {
		this._logger ??= this.AppLogger.createContextualLogger(JWTTokenValidationStrategy.name);
		return this._logger;
	}

	constructor(public readonly Module: ModuleRef) {}

	public async validate(token: string, _context: ExecutionContext): Promise<any> {
		try {
			const payload = await this.JwtService.verifyAsync(token);
			this.logger.debug('JWT token validated successfully');
			return payload;
		} catch (error) {
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
export class BaseAuthGuard implements CanActivate, LazyModuleRefService {
	private _logger: AppLogger | undefined;
	private _config: AuthMiddlewareConfig | undefined;

	public get JwtService(): JwtService {
		return this.Module.get(JwtService);
	}

	public get AppLogger(): AppLogger {
		return this.Module.get(AppLogger);
	}

	public get Config(): AuthMiddlewareConfig {
		return this.Module.get('AUTH_MIDDLEWARE_CONFIG', { strict: false });
	}

	private get logger(): AppLogger {
		this._logger ??= this.AppLogger.createContextualLogger(BaseAuthGuard.name);
		return this._logger;
	}

	constructor(public readonly Module: ModuleRef) {}

	public async canActivate(context: ExecutionContext): Promise<never> {
		const config = this.Config;
		try {
			// Check if authentication is required for this route/resolver
			const isAuthRequired = config.required ?? true;
			if (!isAuthRequired) {
				return true as any;
			}

			// Extract token
			const token = this.extractToken(context, config);
			if (!token) {
				this.logger.debug('No token found in request');
				this.handleAuthError(new UnauthorizedException('No token provided'), context, config);
			}

			// Validate token
			const payload = await this.validateToken(token!, context, config);

			// Store user in request context
			this.setUserInContext(context, payload);

			// Check roles/permissions if specified
			if (config.roles ?? config.permissions) {
				this.checkRolesAndPermissions(payload, config);
			}

			// Run custom validation if provided
			if (config.customValidator) {
				const isValid = await config.customValidator(payload, context);
				if (!isValid) {
					this.handleAuthError(new UnauthorizedException('Custom validation failed'), context, config);
				}
			}

			return true;
		} catch (error) {
			this.handleAuthError(error, context, config);
		}
	}

	/**
	 * Extract token using configured strategy
	 */
	private extractToken(context: ExecutionContext, config: AuthMiddlewareConfig): string | null {
		const strategy = config.tokenExtractionStrategy ?? this.getDefaultTokenExtractionStrategy(context);
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
		} catch {
			// Fall back to HTTP
			return new HeaderTokenExtractionStrategy();
		}
	}

	/**
	 * Validate token using configured strategy
	 */
	private async validateToken(token: string, context: ExecutionContext, config: AuthMiddlewareConfig): Promise<any> {
		const strategy = config.authValidationStrategy ?? new JWTTokenValidationStrategy(this.Module);
		const result = await strategy.validate(token, context);
		return result;
	}

	/**
	 * Handle authentication errors using configured strategy
	 */
	private handleAuthError(error: any, context: ExecutionContext, config: AuthMiddlewareConfig): never {
		const strategy = config.errorHandlingStrategy ?? new DefaultAuthErrorHandlingStrategy();
		strategy.handleError(error, context);
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
		} catch {
			// Try GraphQL context
			try {
				const gqlContext = (context as any).getContext?.();
				if (gqlContext) {
					gqlContext.user = payload;
				}
			} catch {
				this.logger.warn('Could not set user in context - unsupported context type');
			}
		}
	}

	/**
	 * Check roles and permissions
	 */
	private checkRolesAndPermissions(payload: any, config: AuthMiddlewareConfig): void {
		const userRoles = payload.roles ?? [];
		const userPermissions = payload.permissions ?? [];

		// Check roles
		if (config.roles) {
			const hasRequiredRole = config.roles.some(role => userRoles.includes(role));
			if (!hasRequiredRole) {
				this.logger.warn(`User missing required roles: ${config.roles.join(', ')}`);
				throw new UnauthorizedException('Insufficient permissions');
			}
		}

		// Check permissions
		if (config.permissions) {
			const hasRequiredPermission = config.permissions.every(permission =>
				userPermissions.includes(permission),
			);
			if (!hasRequiredPermission) {
				this.logger.warn(`User missing required permissions: ${config.permissions.join(', ')}`);
				throw new UnauthorizedException('Insufficient permissions');
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
			...config,
		};
	}

	/**
	 * Create optional auth configuration (authentication not required)
	 */
	public static createOptionalAuth(config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: false,
			...config,
		};
	}

	/**
	 * Create role-based auth configuration
	 */
	public static createRoleBasedAuth(roles: string[], config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: true,
			roles,
			...config,
		};
	}

	/**
	 * Create permission-based auth configuration
	 */
	public static createPermissionBasedAuth(permissions: string[], config: Partial<AuthMiddlewareConfig> = {}): AuthMiddlewareConfig {
		return {
			required: true,
			permissions,
			...config,
		};
	}

	/**
	 * Create custom auth configuration
	 */
	public static createCustomAuth(
		customValidator: (payload: any, context: ExecutionContext) => boolean | Promise<boolean>,
		config: Partial<AuthMiddlewareConfig> = {},
	): AuthMiddlewareConfig {
		return {
			required: true,
			customValidator,
			...config,
		};
	}
}
