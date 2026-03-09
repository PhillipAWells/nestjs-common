/**
 * GraphQL Authentication Decorators
 *
 * Re-exports authentication and authorization decorators from @pawells/nestjs-auth
 * for use in GraphQL resolvers. These decorators provide both base functionality
 * and GraphQL-specific variants optimized for GraphQL execution context.
 *
 * This module eliminates duplication by centralizing auth decorators in the
 * nestjs-auth package while maintaining GraphQL-specific functionality.
 *
 * @packageDocumentation
 */

// TODO: Re-enable these exports after breaking circular dependency with @pawells/nestjs-auth
// Re-export base authentication decorators from nestjs-auth
// export {
// 	Auth,
// 	Public,
// 	Roles,
// 	CurrentUser,
// 	AuthToken,
// 	IS_PUBLIC_KEY,
// 	ROLES_KEY
// } from '@pawells/nestjs-auth';

// Re-export GraphQL-specific decorator variants from nestjs-auth
// export {
// 	GraphQLPublic,
// 	GraphQLAuth,
// 	GraphQLRoles,
// 	GraphQLCurrentUser,
// 	GraphQLAuthToken,
// 	GraphQLContextParam,
// 	GraphQLUser
// } from '@pawells/nestjs-auth';
