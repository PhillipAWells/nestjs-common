import { LoggerService } from '@nestjs/common';
import { AppLogger } from './logger.service.js';

/**
 * Adapts {@link AppLogger} to the NestJS {@link LoggerService} interface.
 *
 * Pass an instance to `NestFactory.create()` via the `logger` option to route
 * all framework bootstrap and lifecycle logs through `AppLogger`, eliminating
 * the default `[Nest]` format and producing a single, consistent log format.
 *
 * @example
 * ```ts
 * const app = await NestFactory.create(AppModule, {
 *   logger: new NestLoggerAdapter(),
 * });
 * ```
 */
export class NestLoggerAdapter implements LoggerService {
	private readonly Logger: AppLogger;

	/**
	 * @param logger - Optional existing `AppLogger` instance to delegate to.
	 *   When omitted, a new `AppLogger` is created using environment variables
	 *   (`SERVICE_NAME`, `LOG_LEVEL`, `LOG_FORMAT`).
	 */
	constructor(logger?: AppLogger) {
		this.Logger = logger ?? new AppLogger();
	}

	/** Maps NestJS `log()` (INFO level) to {@link AppLogger.info}. */
	public Log(message: any, ...optionalParams: any[]): void {
		const context = this.extractContext(optionalParams);
		this.Logger.info(this.formatMessage(message), context);
	}

	/**
	 * Maps NestJS `error()` to {@link AppLogger.error}.
	 *
	 * NestJS calls this as `error(message, stack?, context?)`.
	 * When a stack trace is present it is forwarded as `metadata.stack`.
	 */
	public Error(message: any, ...optionalParams: any[]): void {
		const { context, stack } = this.extractErrorParams(optionalParams);
		const msg = this.formatMessage(message);
		if (stack !== undefined) {
			this.Logger.error(msg, context, { stack });
		} else {
			this.Logger.error(msg, context);
		}
	}

	/** Maps NestJS `warn()` to {@link AppLogger.warn}. */
	public Warn(message: any, ...optionalParams: any[]): void {
		const context = this.extractContext(optionalParams);
		this.Logger.warn(this.formatMessage(message), context);
	}

	/** Maps NestJS `debug()` to {@link AppLogger.debug}. */
	public Debug(message: any, ...optionalParams: any[]): void {
		const context = this.extractContext(optionalParams);
		this.Logger.debug(this.formatMessage(message), context);
	}

	/**
	 * Maps NestJS `verbose()` to {@link AppLogger.debug}.
	 * `AppLogger` has no `verbose` level; `debug` is the nearest equivalent.
	 */
	public Verbose(message: any, ...optionalParams: any[]): void {
		const context = this.extractContext(optionalParams);
		this.Logger.debug(this.formatMessage(message), context);
	}

	/** Maps NestJS `fatal()` to {@link AppLogger.fatal}. */
	public Fatal(message: any, ...optionalParams: any[]): void {
		const context = this.extractContext(optionalParams);
		this.Logger.fatal(this.formatMessage(message), context);
	}

	/**
	 * Extracts the NestJS context string (e.g. `"NestFactory"`, `"RouterExplorer"`)
	 * from variadic params. NestJS passes context as the last string argument.
	 */
	private extractContext(params: any[]): string | undefined {
		if (params.length === 0) return undefined;
		const last = params[params.length - 1];
		return typeof last === 'string' ? last : undefined;
	}

	/**
	 * Extracts `stack` and `context` from variadic error params.
	 *
	 * NestJS error signature: `error(message, stack?, context?)` where `stack`
	 * is a multiline string (contains `\n`) or begins with `"Error:"`.
	 */
	private extractErrorParams(params: any[]): { stack?: string; context?: string; } {
		if (params.length === 0) return {};

		if (params.length === 1) {
			const [param] = params;
			if (typeof param !== 'string') return {};
			return this.looksLikeStack(param) ? { stack: param } : { context: param };
		}

		const [first, ...rest] = params;
		if (typeof first === 'string' && this.looksLikeStack(first)) {
			const contextParam = rest[rest.length - 1];
			return {
				stack: first,
				context: typeof contextParam === 'string' ? contextParam : undefined,
			};
		}

		// No stack — treat last string param as context
		const last = params[params.length - 1];
		return { context: typeof last === 'string' ? last : undefined };
	}

	/** Returns `true` if the string looks like a stack trace. */
	private looksLikeStack(value: string): boolean {
		return value.includes('\n') || value.startsWith('Error:');
	}

	/** Coerces any log message type to a string. */
	private formatMessage(message: any): string {
		if (message instanceof Error) return message.message;
		if (typeof message === 'string') return message;
		return String(message);
	}
}
