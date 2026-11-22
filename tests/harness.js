// Minimal browser test harness: describe / test / expect.
// Filter with ?filter=<text> (matches file, group or test name, case-insensitive).

const registered = [];
let currentFile = '';
const groupStack = [];

export function setFile(name) {
  currentFile = name;
}

export function describe(name, body) {
  groupStack.push(name);
  try {
    body();
  } finally {
    groupStack.pop();
  }
}

export function test(name, body) {
  registered.push({ file: currentFile, group: groupStack.join(' › '), name, body });
}

function show(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key]));
}

class AssertionError extends Error {}

export function expect(actual) {
  const fail = (message) => {
    throw new AssertionError(message);
  };
  return {
    toBe(expected) {
      if (!Object.is(actual, expected)) fail(`expected ${show(actual)} to be ${show(expected)}`);
    },
    toEqual(expected) {
      if (!deepEqual(actual, expected)) fail(`expected ${show(actual)} to equal ${show(expected)}`);
    },
    toBeCloseTo(expected, digits = 6) {
      if (Math.abs(actual - expected) > 10 ** -digits / 2) fail(`expected ${actual} to be close to ${expected}`);
    },
    toBeTruthy() {
      if (!actual) fail(`expected ${show(actual)} to be truthy`);
    },
    toBeFalsy() {
      if (actual) fail(`expected ${show(actual)} to be falsy`);
    },
    toBeNull() {
      if (actual !== null) fail(`expected ${show(actual)} to be null`);
    },
    toContain(item) {
      if (!actual.includes(item)) fail(`expected ${show(actual)} to contain ${show(item)}`);
    },
    toHaveLength(length) {
      if (actual?.length !== length) fail(`expected length ${length}, got ${actual?.length}`);
    },
    /** expect(fn).toThrow(check) – check: error class, code string, or predicate */
    toThrow(check) {
      let error = null;
      try {
        actual();
      } catch (caught) {
        error = caught;
      }
      if (!error) fail('expected function to throw');
      if (typeof check === 'string' && error.code !== check) fail(`expected error code ${check}, got ${error.code ?? error.message}`);
      if (typeof check === 'function' && check.prototype instanceof Error && !(error instanceof check)) {
        fail(`expected ${check.name}, got ${error.name}`);
      }
      return error;
    },
  };
}

/** Runs registered tests (no DOM needed). */
export async function runAll(filterText = '') {
  const filter = filterText.toLowerCase();
  const selected = registered.filter(({ file, group, name }) =>
    !filter || `${file} ${group} ${name}`.toLowerCase().includes(filter));

  const results = [];
  for (const entry of selected) {
    const start = performance.now();
    try {
      await entry.body();
      results.push({ ...entry, ok: true, ms: performance.now() - start });
    } catch (error) {
      results.push({ ...entry, ok: false, error, ms: performance.now() - start });
    }
  }
  return results;
}

export async function run(root) {
  const filter = (new URLSearchParams(location.search).get('filter') ?? '').toLowerCase();
  const results = await runAll(filter);
  const failed = results.filter((result) => !result.ok);
  const summary = `${results.length - failed.length}/${results.length} passed`;
  document.title = `${failed.length ? '✗' : '✓'} ${summary}`;

  const header = document.createElement('h1');
  header.textContent = `${failed.length ? '✗' : '✓'} ${summary}${filter ? ` (filter: ${filter})` : ''}`;
  header.className = failed.length ? 'fail' : 'pass';
  root.append(header);

  let lastFile = null;
  let list = null;
  for (const result of results) {
    if (result.file !== lastFile) {
      lastFile = result.file;
      const heading = document.createElement('h2');
      const link = document.createElement('a');
      link.href = `?filter=${encodeURIComponent(result.file)}`;
      link.textContent = result.file;
      heading.append(link);
      list = document.createElement('ul');
      root.append(heading, list);
    }
    const item = document.createElement('li');
    item.className = result.ok ? 'pass' : 'fail';
    item.textContent = `${result.ok ? '✓' : '✗'} ${result.group ? `${result.group} › ` : ''}${result.name}`;
    if (!result.ok) {
      const detail = document.createElement('pre');
      detail.textContent = result.error?.stack ?? String(result.error);
      item.append(detail);
      console.error(`FAIL ${result.file} › ${result.group} › ${result.name}`, result.error);
    }
    list.append(item);
  }
  window.__testResults = { total: results.length, failed: failed.length, failures: failed.map((f) => `${f.file} › ${f.group} › ${f.name}: ${f.error?.message}`) };
  return window.__testResults;
}
