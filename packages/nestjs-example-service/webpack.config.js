const { composePlugins, withNx } = require('@nx/webpack');

module.exports = composePlugins(
	withNx({
		target: 'node',
		compiler: 'swc',
	}),
	(config) => {
		// Ensure decorator metadata is enabled for NestJS DI
		if (config.module) {
			for (const rule of config.module.rules ?? []) {
				if (
					rule &&
					typeof rule === 'object' &&
					'use' in rule &&
					Array.isArray(rule.use)
				) {
					for (const loader of rule.use) {
						if (
							loader &&
							typeof loader === 'object' &&
							'loader' in loader &&
							typeof loader.loader === 'string' &&
							loader.loader.includes('swc-loader')
						) {
							loader.options ??= {};
							loader.options.jsc ??= {};
							loader.options.jsc.transform ??= {};
							loader.options.jsc.transform.decoratorMetadata = true;
						}
					}
				}
			}
		}

		return config;
	},
);
