import { InjectionToken, ModuleMetadata, OptionalFactoryDependency } from '@nestjs/common';
import { IPyroscopeConfig } from './profiling.interface.js';

export interface IPyroscopeModuleOptions {
	isGlobal?: boolean;
	config: IPyroscopeConfig | (() => IPyroscopeConfig);
}

export interface IPyroscopeModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	isGlobal?: boolean;
	/**
	 * Whether to register the health check controller.
	 * Defaults to true. Set to false to disable the /profiling/health, /profiling/metrics,
	 * /profiling/status, and /profiling/metrics/prometheus endpoints.
	 */
	enableHealthChecks?: boolean;
	useFactory: (...args: unknown[]) => IPyroscopeConfig;
	inject?: Array<InjectionToken | OptionalFactoryDependency>;
}
