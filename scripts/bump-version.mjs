#!/usr/bin/env node

/**
 * Cache-Busting Version Bump Script
 * Automatically increments all ?v=\d+ occurrences in index.html to ensure
 * mobile browsers and returning visitors immediately fetch updated CSS and ES modules.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, '..', 'index.html');

const html = readFileSync(indexPath, 'utf8');

// Find existing versions
const matches = [...html.matchAll(/\?v=(\d+)/g)];
if (matches.length === 0) {
  console.error('No ?v=\\d+ version parameters found in index.html');
  process.exit(1);
}

const currentVersion = Math.max(...matches.map(m => parseInt(m[1], 10)));
const nextVersion = currentVersion + 1;

console.log(`Bumping cache-bust version in index.html from v${currentVersion} to v${nextVersion}...`);

const updatedHtml = html.replace(/\?v=\d+/g, `?v=${nextVersion}`);
writeFileSync(indexPath, updatedHtml, 'utf8');

console.log(`Successfully updated ${matches.length} references to ?v=${nextVersion}!`);
