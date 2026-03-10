import {
	ProfilingConfigValidator,
	TagFormatter,
	MetricAggregator,
	ProfilingErrorHandler,
	generateProfileId,
	formatDuration,
	isProfilingEnabled,
} from './profiling.utils.js';
import { IPyroscopeConfig } from '../interfaces/profiling.interface.js';

describe('Profiling Utils', () => {
	describe('ProfilingConfigValidator', () => {
		describe('validate', () => {
			it('should validate valid configuration', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(true);
				expect(result.errors).toHaveLength(0);
			});

			it('should require serverAddress', () => {
				const config: any = {
					enabled: true,
					applicationName: 'test-app',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain('serverAddress is required');
			});

			it('should require serverAddress to start with http', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'localhost:4040',
					applicationName: 'test-app',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain('serverAddress must start with http:// or https://');
			});

			it('should accept https serverAddress', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'https://pyroscope.example.com',
					applicationName: 'test-app',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(true);
			});

			it('should require applicationName', () => {
				const config: any = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain('applicationName is required');
			});

			it('should validate sampleRate range', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					sampleRate: 1.5,
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain('sampleRate must be between 0 and 1');
			});

			it('should accept valid sampleRate', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					sampleRate: 0.5,
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(true);
			});

			it('should validate profile types', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					profileTypes: ['cpu', 'invalid' as any],
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain('Invalid profile types: invalid');
			});

			it('should accept valid profile types', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					profileTypes: ['cpu', 'memory', 'goroutine'],
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(true);
			});

			it('should require basicAuthPassword when basicAuthUser is provided', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					basicAuthUser: 'user',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain(
					'basicAuthPassword is required when basicAuthUser is provided',
				);
			});

			it('should require basicAuthUser when basicAuthPassword is provided', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					basicAuthPassword: 'password',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors).toContain(
					'basicAuthUser is required when basicAuthPassword is provided',
				);
			});

			it('should accept both basicAuth credentials', () => {
				const config: IPyroscopeConfig = {
					enabled: true,
					serverAddress: 'http://localhost:4040',
					applicationName: 'test-app',
					basicAuthUser: 'user',
					basicAuthPassword: 'password',
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(true);
			});

			it('should return multiple errors', () => {
				const config: any = {
					enabled: true,
					sampleRate: 2,
				};

				const result = ProfilingConfigValidator.validate(config);

				expect(result.isValid).toBe(false);
				expect(result.errors.length).toBeGreaterThan(1);
			});
		});
	});

	describe('TagFormatter', () => {
		describe('format', () => {
			it('should convert camelCase to snake_case', () => {
				const tags = {
					userName: 'john',
					userId: '123',
					requestType: 'GET',
				};

				const formatted = TagFormatter.format(tags);

				expect(formatted).toEqual({
					user_name: 'john',
					user_id: '123',
					request_type: 'GET',
				});
			});

			it('should handle tags without capital letters', () => {
				const tags = {
					service: 'api',
					version: '1.0',
				};

				const formatted = TagFormatter.format(tags);

				expect(formatted).toEqual({
					service: 'api',
					version: '1.0',
				});
			});

			it('should convert values to strings', () => {
				const tags = {
					count: 123 as any,
					active: true as any,
				};

				const formatted = TagFormatter.format(tags);

				expect(formatted).toEqual({
					count: '123',
					active: 'true',
				});
			});

			it('should handle empty tags object', () => {
				const formatted = TagFormatter.format({});

				expect(formatted).toEqual({});
			});
		});

		describe('merge', () => {
			it('should merge tags with override taking precedence', () => {
				const baseTags = { env: 'dev', service: 'api', version: '1.0' };
				const overrideTags = { env: 'prod', region: 'us-east-1' };

				const merged = TagFormatter.merge(baseTags, overrideTags);

				expect(merged).toEqual({
					env: 'prod',
					service: 'api',
					version: '1.0',
					region: 'us-east-1',
				});
			});

			it('should handle empty base tags', () => {
				const overrideTags = { key: 'value' };

				const merged = TagFormatter.merge({}, overrideTags);

				expect(merged).toEqual({ key: 'value' });
			});

			it('should handle empty override tags', () => {
				const baseTags = { key: 'value' };

				const merged = TagFormatter.merge(baseTags, {});

				expect(merged).toEqual({ key: 'value' });
			});
		});

		describe('sanitize', () => {
			it('should filter out null values', () => {
				const tags = {
					valid: 'value',
					nullValue: null as any,
				};

				const sanitized = TagFormatter.sanitize(tags);

				expect(sanitized).toEqual({ valid: 'value' });
			});

			it('should filter out undefined values', () => {
				const tags = {
					valid: 'value',
					undefinedValue: undefined as any,
				};

				const sanitized = TagFormatter.sanitize(tags);

				expect(sanitized).toEqual({ valid: 'value' });
			});

			it('should filter out empty strings', () => {
				const tags = {
					valid: 'value',
					empty: '',
				};

				const sanitized = TagFormatter.sanitize(tags);

				expect(sanitized).toEqual({ valid: 'value' });
			});

			it('should truncate long values to max length', () => {
				const longValue = 'a'.repeat(300);
				const tags = {
					long: longValue,
				};

				const sanitized = TagFormatter.sanitize(tags, 100);

				expect(sanitized.long.length).toBe(100);
			});

			it('should use default max length', () => {
				const longValue = 'a'.repeat(500);
				const tags = {
					long: longValue,
				};

				const sanitized = TagFormatter.sanitize(tags);

				expect(sanitized.long).toBeDefined();
				expect(sanitized.long.length).toBeLessThanOrEqual(256);
			});

			it('should convert non-string values to strings', () => {
				const tags = {
					number: 123 as any,
					boolean: true as any,
				};

				const sanitized = TagFormatter.sanitize(tags);

				expect(sanitized).toEqual({
					number: '123',
					boolean: 'true',
				});
			});
		});
	});

	describe('MetricAggregator', () => {
		describe('averageDuration', () => {
			it('should calculate average duration', () => {
				const metrics = [
					{ duration: 100 },
					{ duration: 200 },
					{ duration: 300 },
				];

				const average = MetricAggregator.averageDuration(metrics);

				expect(average).toBe(200);
			});

			it('should return 0 for empty metrics', () => {
				const average = MetricAggregator.averageDuration([]);

				expect(average).toBe(0);
			});

			it('should handle single metric', () => {
				const metrics = [{ duration: 150 }];

				const average = MetricAggregator.averageDuration(metrics);

				expect(average).toBe(150);
			});
		});

		describe('percentile', () => {
			it('should calculate 50th percentile (median)', () => {
				const metrics = [
					{ duration: 100 },
					{ duration: 200 },
					{ duration: 300 },
					{ duration: 400 },
					{ duration: 500 },
				];

				const p50 = MetricAggregator.percentile(metrics, 50);

				expect(p50).toBe(300);
			});

			it('should calculate 95th percentile', () => {
				const metrics = Array.from({ length: 100 }, (_, i) => ({ duration: i + 1 }));

				const p95 = MetricAggregator.percentile(metrics, 95);

				expect(p95).toBe(95);
			});

			it('should calculate 99th percentile', () => {
				const metrics = Array.from({ length: 100 }, (_, i) => ({ duration: i + 1 }));

				const p99 = MetricAggregator.percentile(metrics, 99);

				expect(p99).toBe(99);
			});

			it('should return 0 for empty metrics', () => {
				const p50 = MetricAggregator.percentile([], 50);

				expect(p50).toBe(0);
			});

			it('should handle single metric', () => {
				const metrics = [{ duration: 250 }];

				const p50 = MetricAggregator.percentile(metrics, 50);

				expect(p50).toBe(250);
			});
		});

		describe('groupByTags', () => {
			it('should group metrics by single tag', () => {
				const metrics = [
					{ duration: 100, tags: { env: 'dev' } },
					{ duration: 200, tags: { env: 'prod' } },
					{ duration: 300, tags: { env: 'dev' } },
				];

				const grouped = MetricAggregator.groupByTags(metrics, ['env']);

				expect(grouped['dev']).toHaveLength(2);
				expect(grouped['prod']).toHaveLength(1);
			});

			it('should group metrics by multiple tags', () => {
				const metrics = [
					{ duration: 100, tags: { env: 'dev', region: 'us' } },
					{ duration: 200, tags: { env: 'prod', region: 'us' } },
					{ duration: 300, tags: { env: 'dev', region: 'eu' } },
				];

				const grouped = MetricAggregator.groupByTags(metrics, ['env', 'region']);

				expect(grouped['dev_us']).toHaveLength(1);
				expect(grouped['prod_us']).toHaveLength(1);
				expect(grouped['dev_eu']).toHaveLength(1);
			});

			it('should handle missing tags with "unknown" value', () => {
				const metrics = [
					{ duration: 100, tags: { env: 'dev' } },
					{ duration: 200 },
				];

				const grouped = MetricAggregator.groupByTags(metrics, ['env']);

				expect(grouped['dev']).toHaveLength(1);
				expect(grouped['unknown']).toHaveLength(1);
			});

			it('should handle empty metrics', () => {
				const grouped = MetricAggregator.groupByTags([], ['env']);

				expect(grouped).toEqual({});
			});
		});
	});

	describe('ProfilingErrorHandler', () => {
		describe('isRecoverableError', () => {
			it('should identify connection refused errors as recoverable', () => {
				const error = new Error('ECONNREFUSED');

				expect(ProfilingErrorHandler.isRecoverableError(error)).toBe(true);
			});

			it('should identify not found errors as recoverable', () => {
				const error = new Error('ENOTFOUND');

				expect(ProfilingErrorHandler.isRecoverableError(error)).toBe(true);
			});

			it('should identify timeout errors as recoverable', () => {
				const error = new Error('Request timeout');

				expect(ProfilingErrorHandler.isRecoverableError(error)).toBe(true);
			});

			it('should identify 401 errors as not recoverable', () => {
				const error = new Error('401 Unauthorized');

				expect(ProfilingErrorHandler.isRecoverableError(error)).toBe(false);
			});

			it('should identify 403 errors as not recoverable', () => {
				const error = new Error('403 Forbidden');

				expect(ProfilingErrorHandler.isRecoverableError(error)).toBe(false);
			});

			it('should identify unknown errors as not recoverable', () => {
				const error = new Error('Unknown error');

				expect(ProfilingErrorHandler.isRecoverableError(error)).toBe(false);
			});
		});

		describe('formatError', () => {
			it('should format connection refused errors', () => {
				const error = new Error('ECONNREFUSED');

				const formatted = ProfilingErrorHandler.formatError(error);

				expect(formatted).toContain('Unable to connect to Pyroscope server');
			});

			it('should format 401 errors', () => {
				const error = new Error('401 Authentication failed');

				const formatted = ProfilingErrorHandler.formatError(error);

				expect(formatted).toContain('Authentication failed');
			});

			it('should format 403 errors', () => {
				const error = new Error('403 Access denied');

				const formatted = ProfilingErrorHandler.formatError(error);

				expect(formatted).toContain('Access forbidden');
			});

			it('should format generic errors', () => {
				const error = new Error('Something went wrong');

				const formatted = ProfilingErrorHandler.formatError(error);

				expect(formatted).toBe('Profiling operation failed');
			});
		});

		describe('getRetryDelay', () => {
			it('should return 0 for non-recoverable errors', () => {
				const error = new Error('401 Unauthorized');

				const delay = ProfilingErrorHandler.getRetryDelay(error, 1);

				expect(delay).toBe(0);
			});

			it('should calculate exponential backoff for recoverable errors', () => {
				const error = new Error('ECONNREFUSED');

				const delay1 = ProfilingErrorHandler.getRetryDelay(error, 1, 1000, 10000, 0);
				const delay2 = ProfilingErrorHandler.getRetryDelay(error, 2, 1000, 10000, 0);

				expect(delay2).toBeGreaterThan(delay1);
			});

			it('should respect max delay', () => {
				const error = new Error('ECONNREFUSED');
				const maxDelay = 5000;

				const delay = ProfilingErrorHandler.getRetryDelay(error, 10, 1000, maxDelay, 0);

				expect(delay).toBeLessThanOrEqual(maxDelay);
			});

			it('should add jitter to delay', () => {
				const error = new Error('timeout');

				const delay1 = ProfilingErrorHandler.getRetryDelay(error, 1, 1000, 10000, 1000);
				const delay2 = ProfilingErrorHandler.getRetryDelay(error, 1, 1000, 10000, 1000);

				// Due to jitter, delays might be different
				expect(delay1).toBeGreaterThan(0);
				expect(delay2).toBeGreaterThan(0);
			});
		});
	});

	describe('generateProfileId', () => {
		it('should generate unique profile IDs', () => {
			const id1 = generateProfileId();
			const id2 = generateProfileId();

			expect(id1).not.toBe(id2);
		});

		it('should use default prefix', () => {
			const id = generateProfileId();

			expect(id).toMatch(/^profile_\d+_[a-z0-9]+$/);
		});

		it('should use custom prefix', () => {
			const id = generateProfileId('custom');

			expect(id).toMatch(/^custom_\d+_[a-z0-9]+$/);
		});

		it('should include timestamp', () => {
			const before = Date.now();
			const id = generateProfileId();
			const after = Date.now();

			const timestamp = parseInt(id.split('_')[1], 10);

			expect(timestamp).toBeGreaterThanOrEqual(before);
			expect(timestamp).toBeLessThanOrEqual(after);
		});
	});

	describe('formatDuration', () => {
		it('should format milliseconds', () => {
			expect(formatDuration(500)).toBe('500.00ms');
			expect(formatDuration(1.5)).toBe('1.50ms');
		});

		it('should format seconds', () => {
			expect(formatDuration(1000)).toBe('1.00s');
			expect(formatDuration(2500)).toBe('2.50s');
		});

		it('should handle zero', () => {
			expect(formatDuration(0)).toBe('0.00ms');
		});

		it('should round to 2 decimal places', () => {
			expect(formatDuration(123.456)).toBe('123.46ms');
			expect(formatDuration(1234.567)).toBe('1.23s');
		});
	});

	describe('isProfilingEnabled', () => {
		const originalEnv = process.env['PYROSCOPE_ENABLED'];

		afterEach(() => {
			if (originalEnv !== undefined) {
				process.env['PYROSCOPE_ENABLED'] = originalEnv;
			} else {
				delete process.env['PYROSCOPE_ENABLED'];
			}
		});

		it('should return true when PYROSCOPE_ENABLED is "true"', () => {
			process.env['PYROSCOPE_ENABLED'] = 'true';

			expect(isProfilingEnabled()).toBe(true);
		});

		it('should return true when PYROSCOPE_ENABLED is "1"', () => {
			process.env['PYROSCOPE_ENABLED'] = '1';

			expect(isProfilingEnabled()).toBe(true);
		});

		it('should return false when PYROSCOPE_ENABLED is "false"', () => {
			process.env['PYROSCOPE_ENABLED'] = 'false';

			expect(isProfilingEnabled()).toBe(false);
		});

		it('should return false when PYROSCOPE_ENABLED is not set', () => {
			delete process.env['PYROSCOPE_ENABLED'];

			expect(isProfilingEnabled()).toBe(false);
		});

		it('should return false for other values', () => {
			process.env['PYROSCOPE_ENABLED'] = 'yes';

			expect(isProfilingEnabled()).toBe(false);
		});
	});
});
