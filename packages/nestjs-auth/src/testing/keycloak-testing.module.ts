/**
 * Keycloak Testing Module
 *
 * A drop-in replacement for KeycloakModule in NestJS test suites.
 * Satisfies all DI tokens exported by KeycloakModule with configurable stubs,
 * without requiring a live Keycloak server or network access.
 *
 * @example
 * ```typescript
 * const moduleRef = await Test.createTestingModule({
 *   imports: [KeycloakTestingModule.forRoot()],
 *   providers: [MyService],
 * }).compile();
 *
 * // Override default valid-token behaviour:
 * const mock = moduleRef.get(MockKeycloakTokenValidationService);
 * mock.setValidateTokenResult({ valid: false, error: 'token_inactive' });
 * ```
 */
import { Module, DynamicModule } from '@nestjs/common';
import { KEYCLOAK_MODULE_OPTIONS } from '../keycloak/keycloak.constants.js';
import { KeycloakTokenValidationService } from '../keycloak/services/keycloak-token-validation.service.js';
import type { IKeycloakModuleOptions } from '../keycloak/keycloak.types.js';
import { MockKeycloakTokenValidationService } from './mocks/keycloak-token-validation.mock.js';

/**
 * Options for KeycloakTestingModule.forRoot().
 */
export interface IKeycloakTestingModuleOptions {
	/**
	 * Partial Keycloak options provided under KEYCLOAK_MODULE_OPTIONS.
	 * Defaults to stub values suitable for unit tests.
	 */
	keycloakOptions?: Partial<IKeycloakModuleOptions>;
}

const DEFAULT_KEYCLOAK_OPTIONS: IKeycloakModuleOptions = {
	authServerUrl: 'https://auth.example.com',
	realm: 'test',
	clientId: 'test-client',
	validationMode: 'online',
};

/**
 * Testing replacement for KeycloakModule.
 * Exports the same tokens as KeycloakModule so consumer DI graphs resolve correctly.
 */
@Module({})
export class KeycloakTestingModule {
	/**
	 * Register the testing module with optional configuration overrides.
	 *
	 * @param options - Optional overrides for default stub values
	 * @returns DynamicModule configuration
	 */
	public static ForRoot(options: IKeycloakTestingModuleOptions = {}): DynamicModule {
		const KeycloakOptions: IKeycloakModuleOptions = {
			...DEFAULT_KEYCLOAK_OPTIONS,
			...options.keycloakOptions,
		};

		return {
			module: KeycloakTestingModule,
			providers: [
				{
					provide: KEYCLOAK_MODULE_OPTIONS,
					useValue: KeycloakOptions,
				},
				MockKeycloakTokenValidationService,
				{
					provide: KeycloakTokenValidationService,
					useExisting: MockKeycloakTokenValidationService,
				},
			],
			exports: [
				KEYCLOAK_MODULE_OPTIONS,
				MockKeycloakTokenValidationService,
				KeycloakTokenValidationService,
			],
		};
	}
}
