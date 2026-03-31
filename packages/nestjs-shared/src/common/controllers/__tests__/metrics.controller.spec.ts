import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetricsController } from '../metrics.controller.js';

describe('MetricsController', () => {
	let controller: MetricsController;
	let mockMetricsService: any;
	let mockLogger: any;
	let mockResponse: any;

	beforeEach(() => {
		mockMetricsService = {
			getMetrics: vi.fn(),
			GetMetrics: vi.fn(),
		};

		mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			log: vi.fn(),
		};

		mockResponse = {
			send: vi.fn().mockReturnThis(),
			status: vi.fn().mockReturnThis(),
		};

		controller = new MetricsController(mockMetricsService, mockLogger);
	});

	describe('getMetrics', () => {
		it('should be defined', () => {
			expect(controller.GetMetrics).toBeDefined();
		});

		it('should return metrics in Prometheus text format', async () => {
			const mockMetricsData = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
`;

			mockMetricsService.GetMetrics.mockResolvedValue(mockMetricsData);

			await controller.GetMetrics(mockResponse);

			expect(mockMetricsService.GetMetrics).toHaveBeenCalled();
			expect(mockResponse.send).toHaveBeenCalledWith(mockMetricsData);
		});

		it('should handle successful metrics collection', async () => {
			const metricsData = `# HELP test_metric Test metric
# TYPE test_metric counter
test_metric 42
`;

			mockMetricsService.GetMetrics.mockResolvedValue(metricsData);

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.status).not.toHaveBeenCalled();
			expect(mockResponse.send).toHaveBeenCalledWith(metricsData);
		});

		it('should return empty string when no metrics available', async () => {
			mockMetricsService.GetMetrics.mockResolvedValue('');

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledWith('');
		});

		it('should handle metrics service errors', async () => {
			const error = new Error('Failed to collect metrics');
			mockMetricsService.GetMetrics.mockRejectedValue(error);

			await controller.GetMetrics(mockResponse);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Failed to collect metrics',
				'Failed to collect metrics',
			);
			expect(mockResponse.status).toHaveBeenCalledWith(500);
			expect(mockResponse.send).toHaveBeenCalledWith('# Error collecting metrics\n');
		});

		it('should log error message when metrics collection fails', async () => {
			const errorMessage = 'Service unavailable';
			mockMetricsService.GetMetrics.mockRejectedValue(new Error(errorMessage));

			await controller.GetMetrics(mockResponse);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Failed to collect metrics',
				errorMessage,
			);
		});

		it('should handle non-Error exceptions', async () => {
			mockMetricsService.GetMetrics.mockRejectedValue('Unknown error');

			await controller.GetMetrics(mockResponse);

			expect(mockLogger.error).toHaveBeenCalledWith(
				'Failed to collect metrics',
				'Unknown error',
			);
			expect(mockResponse.status).toHaveBeenCalledWith(500);
		});

		it('should return 500 status code on error', async () => {
			mockMetricsService.GetMetrics.mockRejectedValue(new Error('Error'));

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.status).toHaveBeenCalledWith(500);
		});

		it('should return error placeholder text to avoid breaking scrapers', async () => {
			mockMetricsService.GetMetrics.mockRejectedValue(new Error('Service error'));

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledWith('# Error collecting metrics\n');
		});

		it('should handle metrics with multiple lines', async () => {
			const complexMetrics = `# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1234
http_requests_total{method="POST",status="201"} 567
http_requests_total{method="GET",status="404"} 89
# HELP http_request_duration_seconds HTTP request duration
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.1"} 100
http_request_duration_seconds_bucket{le="0.5"} 200
http_request_duration_seconds_bucket{le="1.0"} 250
http_request_duration_seconds_sum 123.45
http_request_duration_seconds_count 250
`;

			mockMetricsService.GetMetrics.mockResolvedValue(complexMetrics);

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledWith(complexMetrics);
		});

		it('should not call send twice on success', async () => {
			mockMetricsService.GetMetrics.mockResolvedValue('metrics');

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledTimes(1);
		});

		it('should not call send twice on error', async () => {
			mockMetricsService.GetMetrics.mockRejectedValue(new Error('Error'));

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledTimes(1);
		});

		it('should handle large metrics output', async () => {
			const largeMetrics = Array.from({ length: 1000 }, (_, i) =>
				`metric_${i} ${Math.random() * 1000}`,
			).join('\n');

			mockMetricsService.GetMetrics.mockResolvedValue(largeMetrics);

			await controller.GetMetrics(mockResponse);

			expect(mockResponse.send).toHaveBeenCalledWith(largeMetrics);
		});
	});

	describe('Constructor', () => {
		it('should initialize with MetricsRegistryService', () => {
			expect(controller).toBeInstanceOf(MetricsController);
		});

		it('should initialize with AppLogger', () => {
			expect(controller).toBeInstanceOf(MetricsController);
		});
	});
});
