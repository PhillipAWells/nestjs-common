import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { SharedTestingModule } from '../shared-testing.module.js';
import { MockCacheProvider } from '../mocks/cache-provider.mock.js';
import { MockAppLogger } from '../mocks/app-logger.mock.js';
import { CACHE_PROVIDER } from '../../common/interfaces/cache-provider.interface.js';
import { AppLogger } from '../../common/services/logger.service.js';

describe('SharedTestingModule', () => {
	it('provides MockCacheProvider under its own class token', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [SharedTestingModule],
		}).compile();

		const provider = moduleRef.get(MockCacheProvider);
		expect(provider).toBeInstanceOf(MockCacheProvider);
	});

	it('provides MockCacheProvider under CACHE_PROVIDER token', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [SharedTestingModule],
		}).compile();

		const provider = moduleRef.get(CACHE_PROVIDER);
		expect(provider).toBeInstanceOf(MockCacheProvider);
	});

	it('provides MockAppLogger under its own class token', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [SharedTestingModule],
		}).compile();

		const Logger = moduleRef.get(MockAppLogger);
		expect(Logger).toBeInstanceOf(MockAppLogger);
	});

	it('provides MockAppLogger under AppLogger token', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [SharedTestingModule],
		}).compile();

		const Logger = moduleRef.get(AppLogger);
		expect(Logger).toBeInstanceOf(MockAppLogger);
	});

	it('CACHE_PROVIDER and MockCacheProvider tokens resolve to the same instance', async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [SharedTestingModule],
		}).compile();

		const a = moduleRef.get(CACHE_PROVIDER);
		const b = moduleRef.get(MockCacheProvider);
		expect(a).toBe(b);
	});
});
