import { GraphQLModule } from './graphql.module.js';
import { GraphQLConfigOptions } from './graphql-config.interface.js';
import { GraphQLService } from './graphql.service.js';

describe('GraphQL Module Configuration Validation', () => {
	describe('validateGraphQLConfig', () => {
		it('should accept valid GraphQL configuration options', () => {
			const validOptions: GraphQLConfigOptions = {
				autoSchemaFile: './schema.gql',
				sortSchema: true,
				playground: true,
				introspection: true,
			};

			expect(() => GraphQLModule.forRoot(validOptions)).not.toThrow();
		});

		it('should accept minimal configuration options', () => {
			const minimalOptions: GraphQLConfigOptions = {};

			expect(() => GraphQLModule.forRoot(minimalOptions)).not.toThrow();
		});

		it('should accept configuration with undefined optional fields', () => {
			const optionsWithUndefined: GraphQLConfigOptions = {
				autoSchemaFile: undefined,
				sortSchema: undefined,
				playground: undefined,
				introspection: undefined,
			};

			expect(() => GraphQLModule.forRoot(optionsWithUndefined)).not.toThrow();
		});

		it('should accept valid autoSchemaFile paths', () => {
			const validPaths = [
				'./schema.gql',
				'./src/schema.graphql',
				'schema.gql',
				true, // boolean is also valid for autoSchemaFile
			];

			validPaths.forEach(path => {
				const options: GraphQLConfigOptions = { autoSchemaFile: path };
				expect(() => GraphQLModule.forRoot(options)).not.toThrow();
			});
		});

		it('should accept boolean values for boolean options', () => {
			const booleanOptions: GraphQLConfigOptions = {
				sortSchema: true,
				playground: false,
				introspection: true,
			};

			expect(() => GraphQLModule.forRoot(booleanOptions)).not.toThrow();
		});

		it('should reject invalid configuration with non-boolean sortSchema', () => {
			const invalidOptions: GraphQLConfigOptions = {
				sortSchema: 'true' as any, // Invalid type
			};

			expect(() => GraphQLModule.forRoot(invalidOptions)).toThrow('GraphQL configuration validation failed');
		});

		it('should reject invalid configuration with non-boolean playground', () => {
			const invalidOptions: GraphQLConfigOptions = {
				playground: 1 as any, // Invalid type
			};

			expect(() => GraphQLModule.forRoot(invalidOptions)).toThrow('GraphQL configuration validation failed');
		});

		it('should reject invalid configuration with non-boolean introspection', () => {
			const invalidOptions: GraphQLConfigOptions = {
				introspection: 'false' as any, // Invalid type
			};

			expect(() => GraphQLModule.forRoot(invalidOptions)).toThrow('GraphQL configuration validation failed');
		});
	});

	describe('forRoot method', () => {
		it('should create a dynamic module with valid configuration', () => {
			const options: GraphQLConfigOptions = {
				autoSchemaFile: './test-schema.gql',
				sortSchema: true,
				playground: false,
				introspection: true,
			};

			const module = GraphQLModule.forRoot(options);

			expect(module).toHaveProperty('module', GraphQLModule);
			expect(module).toHaveProperty('imports');
			expect(module).toHaveProperty('providers');
			expect(module).toHaveProperty('exports');
			expect(module).toHaveProperty('global', true);
		});

		it('should set default values when options are not provided', () => {
			const module = GraphQLModule.forRoot({});

			expect(module).toHaveProperty('module', GraphQLModule);
			expect(module.imports).toHaveLength(1);
			expect(module.providers).toContainEqual(GraphQLService);
			expect(module.exports).toContain(GraphQLService);
		});

		it('should include GraphQLService in providers and exports', () => {
			const module = GraphQLModule.forRoot({});

			expect(module.providers).toContain(GraphQLService);
			expect(module.exports).toContain(GraphQLService);
		});

		it('should be a global module', () => {
			const module = GraphQLModule.forRoot({});

			expect(module.global).toBe(true);
		});

		it('should handle context configuration', () => {
			const contextFn = (context: any) => ({ ...context, customField: 'test' });
			const options: GraphQLConfigOptions = {
				context: contextFn,
			};

			const module = GraphQLModule.forRoot(options);

			expect(module).toBeDefined();
			// The context function should be passed to the underlying NestJS GraphQL module
		});

		it('should handle CORS configuration', () => {
			const corsOptions = { origin: 'http://localhost:3000', credentials: true };
			const options: GraphQLConfigOptions = {
				cors: corsOptions,
			};

			const module = GraphQLModule.forRoot(options);

			expect(module).toBeDefined();
			// The CORS options should be passed to the underlying NestJS GraphQL module
		});
	});

	describe('forRootAsync method', () => {
		it('should create a dynamic module for async configuration', () => {
			const asyncConfig = {
				useFactory: () => ({}),
				inject: [],
			};

			const module = GraphQLModule.forRootAsync(asyncConfig);

			expect(module).toHaveProperty('module', GraphQLModule);
			expect(module).toHaveProperty('imports');
			expect(module).toHaveProperty('providers');
			expect(module).toHaveProperty('exports');
			expect(module).toHaveProperty('global', true);
		});

		it('should include GraphQLService in async module', () => {
			const asyncConfig = {
				useFactory: () => ({}),
			};

			const module = GraphQLModule.forRootAsync(asyncConfig);

			expect(module.providers).toContain(GraphQLService);
			expect(module.exports).toContain(GraphQLService);
		});
	});

	describe('Edge cases', () => {
		it('should handle null values gracefully', () => {
			const optionsWithNull: GraphQLConfigOptions = {
				autoSchemaFile: null as any,
				sortSchema: null as any,
				playground: null as any,
				introspection: null as any,
			};

			expect(() => GraphQLModule.forRoot(optionsWithNull)).toThrow('GraphQL configuration validation failed');
		});

		it('should handle empty object', () => {
			const emptyOptions = {} as GraphQLConfigOptions;

			expect(() => GraphQLModule.forRoot(emptyOptions)).not.toThrow();
		});

		it('should handle undefined options', () => {
			const undefinedOptions = undefined as any;

			expect(() => GraphQLModule.forRoot(undefinedOptions)).not.toThrow();
		});
	});

	describe('Complete valid configurations', () => {
		it('should accept full configuration with all options', () => {
			const fullOptions: GraphQLConfigOptions = {
				autoSchemaFile: './schema.gql',
				sortSchema: true,
				playground: true,
				introspection: true,
				context: (ctx: any) => ctx,
				cors: { origin: '*' },
				formatError: (error) => error,
			};

			expect(() => GraphQLModule.forRoot(fullOptions)).not.toThrow();
		});

		it('should accept production-ready configuration', () => {
			const prodOptions: GraphQLConfigOptions = {
				autoSchemaFile: './schema.gql',
				sortSchema: true,
				playground: false,
				introspection: false,
			};

			expect(() => GraphQLModule.forRoot(prodOptions)).not.toThrow();
		});

		it('should accept development configuration', () => {
			const devOptions: GraphQLConfigOptions = {
				autoSchemaFile: './schema.gql',
				sortSchema: true,
				playground: true,
				introspection: true,
			};

			expect(() => GraphQLModule.forRoot(devOptions)).not.toThrow();
		});
	});
});
