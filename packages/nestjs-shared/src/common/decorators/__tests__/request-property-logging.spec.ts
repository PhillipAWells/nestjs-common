 
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('RequestProperty Logging', () => {
	it('should NOT use console.Warn() anywhere in the source code', () => {
		// This test verifies that the decorator implementation doesn't use console.Warn()
		// When we replace console.Warn() with Logger.Warn(), this test should pass

		// Read the decorator source and check for console usage
		const decoratorPath = path.join(__dirname, '../request-property.decorator.ts');
		const sourceCode = fs.readFileSync(decoratorPath, 'utf8');

		// Check that console.Warn() is not present in the source (excluding comments)
		const lines = sourceCode.split('\n');
		const codeLines = lines.filter((line: string) => {
			const trimmed = line.trim();
			// Exclude comment lines and empty lines
			return !trimmed.startsWith('//') &&
				!trimmed.startsWith('*') &&
				!trimmed.startsWith('/*') &&
				trimmed.length > 0;
		});

		const linesWithConsoleWarn = codeLines.filter((line: string) =>
			line.includes('console.Warn()'),
		);

		// This should FAIL initially (console.Warn() is present at lines 152 and 166)
		// and PASS after we replace with Logger.Warn()
		expect(linesWithConsoleWarn).toHaveLength(0);

		// If this fails, show which lines have console.Warn()
		if (linesWithConsoleWarn.length > 0) {
			console.log('Lines with console.Warn():', linesWithConsoleWarn);
		}
	});

	it('should use Logger from @nestjs/common', () => {
		// Verify that Logger is imported
		const decoratorPath = path.join(__dirname, '../request-property.decorator.ts');
		const sourceCode = fs.readFileSync(decoratorPath, 'utf8');

		// Check that Logger is imported from @nestjs/common
		const hasLoggerImport = sourceCode.includes('Logger') &&
			sourceCode.includes('@nestjs/common');

		// This should FAIL initially and PASS after we add the Logger import
		expect(hasLoggerImport).toBe(true);
	});

	it('should create a Logger instance with context name', () => {
		// Verify that a Logger instance is created
		const decoratorPath = path.join(__dirname, '../request-property.decorator.ts');
		const sourceCode = fs.readFileSync(decoratorPath, 'utf8');

		// Check for Logger instance creation
		const hasLoggerInstance = sourceCode.includes('new Logger(') &&
			sourceCode.includes('RequestPropertyDecorator');

		// This should FAIL initially and PASS after we create the logger instance
		expect(hasLoggerInstance).toBe(true);
	});

	it('should use logger.Warn() instead of console.Warn()', () => {
		// Verify that logger.Warn() is used or a logWarning function is implemented
		const decoratorPath = path.join(__dirname, '../request-property.decorator.ts');
		const sourceCode = fs.readFileSync(decoratorPath, 'utf8');

		// Check for appLogger.warn() usage (lazy loading pattern) or logWarning function
		const appLoggerWarnMatches = sourceCode.match(/appLogger(?:Instance)?\.warn\(/g);
		const appLoggerWarnCount = appLoggerWarnMatches ? appLoggerWarnMatches.length : 0;

		// Also check for LogWarning function usage which handles the fallback
		const logWarningMatches = sourceCode.match(/LogWarning\(/g);
		const logWarningCount = logWarningMatches ? logWarningMatches.length : 0;

		// Should have appLogger.warn() calls or LogWarning function implemented
		expect(appLoggerWarnCount + logWarningCount).toBeGreaterThanOrEqual(1);
	});
});
