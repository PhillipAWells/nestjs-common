import { ApolloDriverConfig } from '@nestjs/apollo';

/**
 * Configuration options for the GraphQL module
 */
export interface GraphQLConfigOptions extends Omit<ApolloDriverConfig, 'driver'> {
	/**
   * Path to auto-generated schema file or false to disable
   * @default './schema.gql'
   */
	autoSchemaFile?: string | boolean;

	/**
   * Whether to sort the schema lexicographically
   * @default true
   */
	sortSchema?: boolean;

	/**
   * Enable GraphQL Playground for development
   * @default true
   */
	playground?: boolean;

	/**
   * Enable GraphQL introspection
   * @default true
   */
	introspection?: boolean;

	/**
   * Custom context function or object
   */
	context?: any;

	/**
   * CORS configuration
   */
	cors?: any;

	/**
   * Custom error formatting function
   */
	formatError?: (error: any) => any;

	/**
   * Custom error handling options
   */
	errorHandling?: {
		/**
     * Include stack traces in error responses (development only)
     * @default false
     */
		includeStackTrace?: boolean;

		/**
     * Custom error codes mapping
     */
		errorCodes?: Record<string, string>;
	};

	/**
   * BSON serialization configuration
   */
	bson?: {
		/**
     * Enable BSON serialization support
     * @default false
     */
		enabled?: boolean;

		/**
     * Maximum payload size in bytes
     * @default 10485760 (10MB)
     */
		maxPayloadSize?: number;
	};
}

/**
 * Asynchronous configuration options for the GraphQL module
 */
export interface GraphQLAsyncConfig {
	/**
   * Factory function that returns configuration options
   */
	useFactory: (...args: any[]) => Promise<GraphQLConfigOptions> | GraphQLConfigOptions;

	/**
   * Dependencies to inject into the factory function
   */
	inject?: unknown[];
}
