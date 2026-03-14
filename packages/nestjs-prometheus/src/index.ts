/**
 * @pawells/nestjs-prometheus — Prometheus metrics exporter for NestJS
 *
 * Integrates with @pawells/nestjs-shared InstrumentationRegistry to export metrics
 * in Prometheus text format via a GET /metrics endpoint.
 *
 * @example
 * ```typescript
 * import { PrometheusModule } from '@pawells/nestjs-prometheus';
 *
 * @Module({
 *   imports: [PrometheusModule.forRoot()],
 * })
 * export class AppModule {}
 * // Metrics are now available at: GET /metrics
 * ```
 *
 * @packageDocumentation
 */
export { PrometheusExporter } from './prometheus.exporter.js';
export { PrometheusModule } from './prometheus.module.js';
export { MetricsController } from './controllers/metrics.controller.js';
