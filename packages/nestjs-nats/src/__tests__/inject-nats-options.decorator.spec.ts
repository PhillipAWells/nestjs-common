import { describe, it, expect } from 'vitest';
import { Injectable } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { InjectNatsOptions } from '../decorators/inject-nats-options.decorator.js';
import { NATS_MODULE_OPTIONS } from '../nats.constants.js';
import type { NatsModuleOptions } from '../nats.interfaces.js';

describe('InjectNatsOptions', () => {
	@Injectable()
	class TestService {
		constructor(
			@InjectNatsOptions() public readonly options: Partial<NatsModuleOptions>,
		) {}
	}

	it('should inject the NATS module options', async () => {
		const mockOptions: Partial<NatsModuleOptions> = {
			servers: 'nats://localhost:4222',
			timeout: 5000,
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TestService,
				{ provide: NATS_MODULE_OPTIONS, useValue: mockOptions },
			],
		}).compile();

		const service = module.get<TestService>(TestService);

		expect(service.options).toEqual(mockOptions);
		expect(service.options.servers).toBe('nats://localhost:4222');
		expect(service.options.timeout).toBe(5000);
	});

	it('should inject empty object when no options provided', async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				TestService,
				{ provide: NATS_MODULE_OPTIONS, useValue: {} },
			],
		}).compile();

		const service = module.get<TestService>(TestService);

		expect(service.options).toEqual({});
	});
});
