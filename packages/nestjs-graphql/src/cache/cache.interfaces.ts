/**
 * Async options for CacheModule configuration
 */
export interface CacheModuleAsyncOptions {
	imports?: any[];
	useFactory: (...args: any[]) => any | Promise<any>;
	inject?: any[];
}
