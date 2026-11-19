#!/usr/bin/env node
// Zips extension/ into dist/ for the Chrome Web Store and Firefox Add-ons.
// Uses the system "zip" command (built into macOS and most Linux distributions).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));

execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs'), '--check'], { stdio: 'inherit' });

const dist = path.join(root, 'dist');
const zipFile = path.join(dist, `spoiler-shield-${version}.zip`);
mkdirSync(dist, { recursive: true });
rmSync(zipFile, { force: true });
execFileSync('zip', ['-r', '-X', zipFile, '.', '-x', '.*', '-x', '__MACOSX'], {
  cwd: path.join(root, 'extension'),
  stdio: 'inherit',
});
console.log(`\nCreated ${path.relative(root, zipFile)}`);
