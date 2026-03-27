const Redis = require('ioredis-mock');

export const createMockRedis = () => {
	return new Redis({
		// Mock configuration
		data: {},
	});
};

export const mockRedisProvider = {
	provide: 'REDIS_CLIENT',
	useFactory: () => createMockRedis(),
};
