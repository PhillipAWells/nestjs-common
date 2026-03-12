import { ModuleMetadata } from '@nestjs/common';
import { IPyroscopeConfig } from './profiling.interface.js';

export interface IPyroscopeModuleOptions {
	isGlobal?: boolean;
	config: IPyroscopeConfig | (() => IPyroscopeConfig);
}

export interface IPyroscopeModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
	isGlobal?: boolean;
	useFactory: (...args: unknown[]) => IPyroscopeConfig;
	inject?: any[];
}
