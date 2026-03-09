import { GraphQLService } from '../graphql/graphql.service.js';
import { GraphQLModule } from '../graphql/graphql.module.js';

describe('GraphQLModule', () => {
	describe('forRoot', () => {
		it('should return a dynamic module configuration', () => {
			const module = GraphQLModule.forRoot();

			expect(module).toBeDefined();
			expect(module.module).toBe(GraphQLModule);
			expect(module.providers).toBeDefined();
			expect(module.exports).toBeDefined();
			expect(module.global).toBe(true);
		});

		it('should include GraphQLService in providers and exports', () => {
			const module = GraphQLModule.forRoot();

			expect(module.providers).toContain(GraphQLService);
			expect(module.exports).toContain(GraphQLService);
		});

		it('should configure with custom options', () => {
			const options = {
				autoSchemaFile: './custom-schema.gql',
				playground: false,
				introspection: false
			};

			const module = GraphQLModule.forRoot(options);

			expect(module).toBeDefined();
			expect(module.imports).toBeDefined();
		});
	});

	describe('forRootAsync', () => {
		it('should return a dynamic module configuration for async setup', () => {
			const module = GraphQLModule.forRootAsync({
				useFactory: () => ({
					autoSchemaFile: './test-schema.gql',
					playground: true
				})
			});

			expect(module).toBeDefined();
			expect(module.module).toBe(GraphQLModule);
			expect(module.providers).toBeDefined();
			expect(module.exports).toBeDefined();
			expect(module.global).toBe(true);
		});

		it('should include GraphQLService in providers and exports for async config', () => {
			const module = GraphQLModule.forRootAsync({
				useFactory: () => ({})
			});

			expect(module.providers).toContain(GraphQLService);
			expect(module.exports).toContain(GraphQLService);
		});
	});
});
