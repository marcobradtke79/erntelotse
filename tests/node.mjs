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
process.exitCode = failed.length ? 1 : 0;
