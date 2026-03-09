import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Sync version: reads workspace version from root and updates package version if different
 * Skips private packages (root workspace has "private": true)
 * Usage: node sync-version.mjs
 * Designed to run from package directory with cwd set by NX build
 */

const scriptDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDir, '..');
const packagePath = resolve(process.cwd(), 'package.json');

try {
	// Read workspace package.json
	const workspacePkg = JSON.parse(readFileSync(resolve(workspaceRoot, 'package.json'), 'utf8'));
	const workspaceVersion = workspacePkg.version;

	// Check if package.json exists in current directory
	let pkg;
	try {
		pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
	} catch {
		// package.json doesn't exist or can't be read — skip
		process.exit(0);
	}

	// Skip if this is the workspace root itself (private: true)
	if (pkg.private === true) {
		process.exit(0);
	}

	// If versions differ, update and write back
	if (pkg.version !== workspaceVersion) {
		pkg.version = workspaceVersion;
		writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
		console.log(`Synced version to ${workspaceVersion}`);
	}
} catch (err) {
	console.error('Error syncing version:', err.message);
	process.exit(1);
}
