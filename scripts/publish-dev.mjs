import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';

const sha = execSync('git rev-parse --short HEAD').toString().trim();
const base = JSON.parse(readFileSync('./package.json', 'utf8')).version.replace(/-.*$/, '');
const snap = `${base}-dev.${sha}`;

console.log(`Publishing snapshot: ${snap}`);

const stamped = [];
for (const d of readdirSync('packages')) {
	const p = `packages/${d}/package.json`;
	if (!existsSync(p)) continue;
	const pkg = JSON.parse(readFileSync(p, 'utf8'));
	if (pkg.private) continue;
	pkg.version = snap;
	writeFileSync(p, JSON.stringify(pkg, null, 2) + '\n');
	stamped.push(p);
}

try {
	execSync('yarn build', { stdio: 'inherit' });
	execSync('npx nx release publish --tag dev', { stdio: 'inherit' });
} finally {
	if (stamped.length > 0) {
		execSync(`git restore ${stamped.join(' ')}`, { stdio: 'inherit' });
	}
}
