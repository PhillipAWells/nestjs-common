/**
 * ESLint flat config for @pawells/nestjs-common-workspace
 *
 * NX monorepo. Supports TypeScript, NestJS, and React.
 *
 * Plugins used:
 *   @typescript-eslint     — TypeScript-aware lint rules
 *   @stylistic             — formatting rules (replaces deprecated core formatting rules)
 *   eslint-plugin-import   — import order, extensions, cycle detection
 *   eslint-plugin-unused-imports — prune unused imports automatically
 *   globals                — canonical Node.js global definitions
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMPORT_RESOLVER = {
	typescript: {
		alwaysTryTypes: true,
		project: './tsconfig.base.json',
	},
	node: {
		extensions: ['.js', '.ts', '.tsx'],
	},
};

export default [
	{
		ignores: ['build/**', 'dist/**', '**/*.d.ts', 'node_modules/**', '.nx/**'],
	},

	js.configs.recommended,

	{
		files: ['packages/**/*.ts', 'packages/**/*.tsx'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
			globals: {
				...globals.node,
			},
		},
		plugins: {
			'@typescript-eslint': typescriptEslint,
			'@stylistic': stylistic,
			'import': importPlugin,
			'unused-imports': unusedImports,
		},
		settings: {
			'import/resolver': IMPORT_RESOLVER,
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_',
				},
			],
			'import/no-duplicates': 'error',
			'import/no-cycle': 'warn',
			'import/no-self-import': 'error',
			'@typescript-eslint/explicit-function-return-type': [
				'warn',
				{
					allowExpressions: true,
					allowTypedFunctionExpressions: true,
					allowHigherOrderFunctions: true,
				},
			],
			'@typescript-eslint/explicit-member-accessibility': [
				'warn',
				{
					accessibility: 'explicit',
					overrides: { constructors: 'no-public' },
				},
			],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-inferrable-types': 'off',
			'@typescript-eslint/prefer-nullish-coalescing': 'warn',
			'@typescript-eslint/prefer-optional-chain': 'warn',
			'@typescript-eslint/prefer-for-of': 'warn',
			'@typescript-eslint/prefer-includes': 'warn',
			'@typescript-eslint/prefer-string-starts-ends-with': 'warn',
			'@typescript-eslint/prefer-readonly': 'warn',
			'@typescript-eslint/promise-function-async': ['warn', { checkArrowFunctions: false }],
			'@typescript-eslint/return-await': 'error',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/naming-convention': [
				'warn',
				{ selector: 'class', format: ['PascalCase'] },
				{ selector: 'interface', format: ['PascalCase'] },
				{ selector: 'typeAlias', format: ['PascalCase'] },
				{ selector: 'enum', format: ['PascalCase'] },
				{ selector: 'enumMember', format: ['UPPER_CASE', 'PascalCase'] },
				{ selector: 'typeParameter', format: ['PascalCase'], custom: { regex: '^[A-Z]', match: true } },
				{ selector: 'typeProperty', format: null },
				{ selector: 'objectLiteralProperty', format: null },
				{ selector: 'classProperty', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
				{ selector: 'classMethod', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
				{ selector: 'function', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
				{ selector: 'accessor', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
				{ selector: 'import', modifiers: ['default'], format: ['camelCase', 'PascalCase'] },
				{ selector: 'variable', modifiers: ['destructured'], format: null },
				{ selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'], leadingUnderscore: 'allow' },
				{ selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
			{ selector: 'parameterProperty', format: ['camelCase', 'PascalCase'], leadingUnderscore: 'allow' },
				{ selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow', trailingUnderscore: 'allow' },
			],
			'no-var': 'error',
			'prefer-const': 'warn',
			'one-var': ['warn', 'never'],
			'object-shorthand': ['warn', 'always'],
			'prefer-destructuring': [
				'warn',
				{
					VariableDeclarator: { array: true, object: true },
					AssignmentExpression: { array: true, object: false },
				},
			],
			'eqeqeq': ['error', 'always'],
			'no-self-compare': 'error',
			'use-isnan': ['error', { enforceForSwitchCase: true, enforceForIndexOf: true }],
			'prefer-arrow-callback': 'warn',
			'no-param-reassign': ['warn', { props: false }],
			'prefer-rest-params': 'warn',
			'require-await': 'warn',
			'no-throw-literal': 'error',
			'prefer-promise-reject-errors': 'error',
			'no-empty': ['error', { allowEmptyCatch: true }],
			'consistent-return': 'warn',
			'default-case-last': 'error',
			'no-fallthrough': 'error',
			'guard-for-in': 'warn',
			'no-magic-numbers': ['warn', { ignore: [0, 1, -1, 2], ignoreArrayIndexes: true }],
			'no-unused-private-class-members': 'error',
			'no-redeclare': 'off',
			'@stylistic/indent': ['error', 'tab', { SwitchCase: 1, flatTernaryExpressions: false, offsetTernaryExpressions: false, ignoreComments: false }],
			'@stylistic/no-tabs': 'off',
			'@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
			'@stylistic/padded-blocks': ['error', 'never'],
			'@stylistic/eol-last': 'error',
			'@stylistic/no-extra-semi': 'error',
			'@stylistic/quotes': ['error', 'single'],
			'@stylistic/semi': ['error', 'always'],
			'@stylistic/comma-dangle': ['error', 'always-multiline'],
			'@stylistic/brace-style': ['error', '1tbs'],
			'@stylistic/space-before-blocks': 'error',
			'@stylistic/space-before-function-paren': ['error', { anonymous: 'never', named: 'never', asyncArrow: 'always' }],
			'@stylistic/space-infix-ops': 'error',
			'@stylistic/space-unary-ops': ['error', { words: true, nonwords: false }],
			'@stylistic/object-curly-spacing': ['error', 'always'],
			'@stylistic/array-bracket-spacing': ['error', 'never'],
			'@stylistic/spaced-comment': ['error', 'always'],
			'@stylistic/no-confusing-arrow': 'warn',
			'@stylistic/multiline-ternary': 'off',
			'@stylistic/max-len': 'off',
		},
	},

	{
		files: ['**/__tests__/**/*.ts', '**/*.test.ts', '**/*.spec.ts', '**/__tests__/**/*.tsx', '**/*.test.tsx', '**/*.spec.tsx'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: __dirname,
			},
			globals: {
				...globals.node,
				describe: 'readonly',
				it: 'readonly',
				test: 'readonly',
				expect: 'readonly',
				fail: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly',
				vi: 'readonly',
				jest: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': typescriptEslint,
			'@stylistic': stylistic,
			'import': importPlugin,
			'unused-imports': unusedImports,
		},
		settings: {
			'import/resolver': IMPORT_RESOLVER,
		},
		rules: {
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_',
				},
			],
			'no-magic-numbers': 'off',
			'require-await': 'off',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/naming-convention': 'off',
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-member-accessibility': 'off',
		},
	},

	{
		files: ['*.config.ts', '*.config.mjs', '*.config.js', 'vitest.config.*', 'vite.config.*'],
		languageOptions: {
			parserOptions: {
				allowDefaultProject: true,
			},
		},
		rules: {
			'import/no-cycle': 'off',
		},
	},
];
