import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'andalus-js-check-'));
let checked = 0;
const failures = [];

function checkSource(name, source, extension = '.js') {
  const file = path.join(tempDir, name.replace(/[^a-z0-9_-]/gi, '_') + extension);
  fs.writeFileSync(file, source, 'utf8');
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  checked++;
  if (result.status !== 0) failures.push({ name, output: (result.stderr || result.stdout || 'Syntax check failed').trim() });
}

const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
let match;
let inlineIndex = 0;
while ((match = scriptPattern.exec(html)) !== null) {
  const attrs = match[1] || '';
  const source = match[2] || '';
  if (/\bsrc\s*=/i.test(attrs) || !source.trim()) continue;
  const typeMatch = attrs.match(/\btype\s*=\s*["']([^"']+)["']/i);
  const type = typeMatch ? typeMatch[1].toLowerCase() : '';
  if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) continue;
  checkSource('index-inline-' + (++inlineIndex), source, type === 'module' ? '.mjs' : '.js');
}

for (const fileName of ['student-achievements.js', 'student-requests.js', 'competition-security-admin.js']) {
  const file = path.join(root, fileName);
  if (fs.existsSync(file)) checkSource(fileName, fs.readFileSync(file, 'utf8'));
}

if (failures.length) {
  console.error(JSON.stringify({ checked, failures }, null, 2));
  process.exit(1);
}
console.log('JavaScript syntax checks passed for ' + checked + ' inline/external scripts.');
