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
		const Context = this.ExtractContext(optionalParams);
		this.Logger.info(this.FormatMessage(message), Context);
	}

	/**
	 * Maps NestJS `error()` to {@link AppLogger.error}.
	 *
	 * NestJS calls this as `error(message, stack?, context?)`.
	 * When a stack trace is present it is forwarded as `metadata.stack`.
	 */
	public Error(message: any, ...optionalParams: any[]): void {
		const { context: Context, stack: Stack } = this.ExtractErrorParams(optionalParams);
		const Msg = this.FormatMessage(message);
		if (Stack !== undefined) {
			this.Logger.error(Msg, Context, { stack: Stack });
		} else {
			this.Logger.error(Msg, Context);
		}
	}

	/** Maps NestJS `warn()` to {@link AppLogger.warn}. */
	public Warn(message: any, ...optionalParams: any[]): void {
		const Context = this.ExtractContext(optionalParams);
		this.Logger.warn(this.FormatMessage(message), Context);
	}

	/** Maps NestJS `debug()` to {@link AppLogger.debug}. */
	public Debug(message: any, ...optionalParams: any[]): void {
		const Context = this.ExtractContext(optionalParams);
		this.Logger.debug(this.FormatMessage(message), Context);
	}

	/**
	 * Maps NestJS `verbose()` to {@link AppLogger.debug}.
	 * `AppLogger` has no `verbose` level; `debug` is the nearest equivalent.
	 */
	public Verbose(message: any, ...optionalParams: any[]): void {
		const Context = this.ExtractContext(optionalParams);
		this.Logger.debug(this.FormatMessage(message), Context);
	}

	/** Maps NestJS `fatal()` to {@link AppLogger.fatal}. */
	public Fatal(message: any, ...optionalParams: any[]): void {
		const Context = this.ExtractContext(optionalParams);
		this.Logger.fatal(this.FormatMessage(message), Context);
	}

	/**
	 * Extracts the NestJS context string (e.g. `"NestFactory"`, `"RouterExplorer"`)
	 * from variadic params. NestJS passes context as the last string argument.
	 */
	private ExtractContext(params: any[]): string | undefined {
		if (params.length === 0) return undefined;
		const Last = params[params.length - 1];
		return typeof Last === 'string' ? Last : undefined;
	}

	/**
	 * Extracts `stack` and `context` from variadic error params.
	 *
	 * NestJS error signature: `error(message, stack?, context?)` where `stack`
	 * is a multiline string (contains `\n`) or begins with `"Error:"`.
	 */
	private ExtractErrorParams(params: any[]): { stack?: string; context?: string; } {
		if (params.length === 0) return {};

		if (params.length === 1) {
			const [Param] = params;
			if (typeof Param !== 'string') return {};
			return this.LooksLikeStack(Param) ? { stack: Param } : { context: Param };
		}

		const [First, ...Rest] = params;
		if (typeof First === 'string' && this.LooksLikeStack(First)) {
			const ContextParam = Rest[Rest.length - 1];
			return {
				stack: First,
				context: typeof ContextParam === 'string' ? ContextParam : undefined,
			};
		}

		// No stack — treat last string param as context
		const Last = params[params.length - 1];
		return { context: typeof Last === 'string' ? Last : undefined };
	}

	/** Returns `true` if the string looks like a stack trace. */
	private LooksLikeStack(value: string): boolean {
		return value.includes('\n') || value.startsWith('Error:');
	}

	/** Coerces any log message type to a string. */
	private FormatMessage(message: any): string {
		if (message instanceof Error) return message.message;
		if (typeof message === 'string') return message;
		return String(message);
	}
}
