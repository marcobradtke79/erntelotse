// Writes the precache list and version into sw.js (no build step: the result is committed).
//   node tools/precache.mjs          update sw.js
//   node tools/precache.mjs --check  exit 1 if sw.js is out of date
// The version is a hash of all precached files, so any change to the app gives a new
// cache and the app announces the update.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SW = join(ROOT, 'sw.js');

/** Folders and single files that make up the app; everything else (tests, docs, tools) stays out. */
const FOLDERS = ['js', 'css', 'assets', 'vendor'];
const FILES = ['index.html', 'manifest.webmanifest'];
// assets/social: the preview image for shared links is not part of the app
const SKIP = /(^|\/)(README\.md|LICENSE[^/]*|\.DS_Store)$|^assets\/social\//;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

export function appFiles() {
  const files = [...FILES.map((file) => join(ROOT, file)), ...FOLDERS.flatMap((folder) => walk(join(ROOT, folder)))];
  return files
    .map((path) => relative(ROOT, path).split(sep).join('/'))
    .filter((path) => !SKIP.test(path))
    .sort();
}

export function precacheBlock() {
  const files = appFiles();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(readFileSync(join(ROOT, file)));
  }
  const version = hash.digest('hex').slice(0, 12);
  // './' is the start URL; the fetch handler maps navigations to index.html
  const list = ['./', ...files].map((file) => `  '${file === './' ? file : `./${file}`}',`).join('\n');
  return `// precache:start\nconst VERSION = '${version}';\nconst FILES = [\n${list}\n];\n// precache:end`;
}

export function currentBlock(source = readFileSync(SW, 'utf8')) {
  const match = source.match(/\/\/ precache:start[\s\S]*?\/\/ precache:end/);
  if (!match) throw new Error('sw.js has no precache markers');
  return match[0];
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = readFileSync(SW, 'utf8');
  const next = precacheBlock();
  if (process.argv.includes('--check')) {
    const ok = currentBlock(source) === next;
    console.log(ok ? 'sw.js is up to date' : 'sw.js is out of date: run node tools/precache.mjs');
    process.exitCode = ok ? 0 : 1;
  } else {
    writeFileSync(SW, source.replace(currentBlock(source), next));
    console.log(`sw.js: ${appFiles().length} files, version ${next.match(/VERSION = '(\w+)'/)[1]}`);
  }
}
