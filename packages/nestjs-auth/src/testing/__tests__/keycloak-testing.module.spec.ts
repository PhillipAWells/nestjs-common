import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { KeycloakTestingModule } from '../keycloak-testing.module.js';
import { MockKeycloakTokenValidationService } from '../mocks/keycloak-token-validation.mock.js';
import { KeycloakTokenValidationService } from '../../keycloak/services/keycloak-token-validation.service.js';
import { KEYCLOAK_MODULE_OPTIONS } from '../../keycloak/keycloak.constants.js';

describe('KeycloakTestingModule', () => {
	it('provides MockKeycloakTokenValidationService under its own token', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [KeycloakTestingModule.ForRoot()],
		}).compile();

		const mock = moduleRef.get(MockKeycloakTokenValidationService);
		expect(mock).toBeInstanceOf(MockKeycloakTokenValidationService);
	});

	it('provides MockKeycloakTokenValidationService under KeycloakTokenValidationService token', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [KeycloakTestingModule.ForRoot()],
		}).compile();

		const service = moduleRef.get(KeycloakTokenValidationService);
		expect(service).toBeInstanceOf(MockKeycloakTokenValidationService);
	});

	it('provides KEYCLOAK_MODULE_OPTIONS with default stub values', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [KeycloakTestingModule.ForRoot()],
		}).compile();

		const opts = moduleRef.get(KEYCLOAK_MODULE_OPTIONS);
		expect(opts.authServerUrl).toBe('https://auth.example.com');
		expect(opts.realm).toBe('test');
		expect(opts.clientId).toBe('test-client');
	});

	it('accepts keycloakOptions overrides', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [KeycloakTestingModule.ForRoot({
				keycloakOptions: { clientId: 'my-service', realm: 'production' },
			})],
		}).compile();

		const opts = moduleRef.get(KEYCLOAK_MODULE_OPTIONS);
		expect(opts.clientId).toBe('my-service');
		expect(opts.realm).toBe('production');
	});

	it('MockKeycloakTokenValidationService and KeycloakTokenValidationService resolve to same instance', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [KeycloakTestingModule.ForRoot()],
		}).compile();

		const mock = moduleRef.get(MockKeycloakTokenValidationService);
		const service = moduleRef.get(KeycloakTokenValidationService);
		expect(mock).toBe(service);
	});
});
