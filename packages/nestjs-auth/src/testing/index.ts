/**
 * @pawells/nestjs-auth/testing
 *
 * Testing utilities for nestjs-auth consumers.
 * Import from '@pawells/nestjs-auth/testing' — never from the main entry point.
 *
 * @example
 * ```typescript
 * import { KeycloakTestingModule, MockKeycloakTokenValidationService } from '@pawells/nestjs-auth/testing';
 * ```
 */
export { MockKeycloakTokenValidationService } from './mocks/keycloak-token-validation.mock.js';
export { KeycloakTestingModule, type KeycloakTestingModuleOptions } from './keycloak-testing.module.js';
