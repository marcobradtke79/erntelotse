// Runs the unit tests in Node (no npm needed): node tests/node.mjs [filter]
// The browser page tests/index.html runs the same tests.

import { runAll, setFile } from './harness.js';
import { TEST_FILES } from './files.js';

for (const file of TEST_FILES) {
  setFile(file);
  await import(`./${file}`);
}

const results = await runAll(process.argv[2] ?? '');
const failed = results.filter((result) => !result.ok);
for (const result of failed) {
  console.log(`✗ ${result.file} › ${result.group ? `${result.group} › ` : ''}${result.name}\n  ${result.error?.message}`);
}
console.log(`${failed.length ? '✗' : '✓'} ${results.length - failed.length}/${results.length} passed`);

// Node only: the service worker's precache list must match the app files
const { precacheBlock, currentBlock } = await import('../tools/precache.mjs');
const precacheOk = currentBlock() === precacheBlock();
if (!precacheOk) console.log('✗ sw.js precache list is out of date: run node tools/precache.mjs');

// Node only: the public address must be the same everywhere (index.html, sitemap.xml)
const { readFileSync, existsSync } = await import('node:fs');
const root = new URL('..', import.meta.url);
const page = readFileSync(new URL('index.html', root), 'utf8');
const sitemap = readFileSync(new URL('sitemap.xml', root), 'utf8');
const canonical = page.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
const addresses = [
  page.match(/property="og:url" content="([^"]+)"/)?.[1],
  sitemap.match(/<loc>([^<]+)<\/loc>/)?.[1],
  JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] ?? '{}').url,
];
const image = page.match(/property="og:image" content="([^"]+)"/)?.[1] ?? '';
const addressOk = Boolean(canonical) && addresses.every((address) => address === canonical)
  && image.startsWith(canonical) && existsSync(new URL(image.slice(canonical.length), root));
if (!addressOk) console.log('✗ index.html and sitemap.xml disagree on the public address, or the preview image is missing');
process.exitCode = failed.length || !precacheOk || !addressOk ? 1 : 0;
