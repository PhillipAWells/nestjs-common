import {
	GraphQLPublic,
	GraphQLAuth,
	GraphQLRoles,
	GraphQLCurrentUser,
	GraphQLAuthToken,
	GraphQLContextParam,
	GraphQLUser
} from '../graphql-auth-decorators.js';

describe('GraphQL Auth Decorators', () => {
	describe('Decorator Exports', () => {
		it('should export GraphQLPublic', () => {
			expect(typeof GraphQLPublic).toBe('function');
		});

		it('should export GraphQLAuth', () => {
			expect(typeof GraphQLAuth).toBe('function');
		});

		it('should export GraphQLRoles', () => {
			expect(typeof GraphQLRoles).toBe('function');
		});

		it('should export GraphQLCurrentUser', () => {
			expect(typeof GraphQLCurrentUser).toBe('function');
		});

		it('should export GraphQLAuthToken', () => {
			expect(typeof GraphQLAuthToken).toBe('function');
		});

		it('should export GraphQLContextParam', () => {
			expect(typeof GraphQLContextParam).toBe('function');
		});

		it('should export GraphQLUser', () => {
			expect(typeof GraphQLUser).toBe('function');
		});
	});

	describe('Decorator Functionality', () => {
		it('GraphQLCurrentUser should return a function', () => {
			const decorator = GraphQLCurrentUser();
			expect(typeof decorator).toBe('function');
		});

		it('GraphQLCurrentUser with property should return a function', () => {
			const decorator = GraphQLCurrentUser('profile.name');
			expect(typeof decorator).toBe('function');
		});

		it('GraphQLAuthToken should return a function', () => {
			const decorator = GraphQLAuthToken();
			expect(typeof decorator).toBe('function');
		});

		it('GraphQLContextParam should return a function', () => {
			const decorator = GraphQLContextParam();
			expect(typeof decorator).toBe('function');
		});

		it('GraphQLUser should be an alias for GraphQLCurrentUser', () => {
			expect(GraphQLUser).toBe(GraphQLCurrentUser);
		});
	});
});
