import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { vectors } from './hash-vectors.mjs';

test('api/tests/Fixtures/hash-vectors.json matches the JavaScript matcher (run node scripts/hash-vectors.mjs)', () => {
  const saved = JSON.parse(readFileSync(new URL('../api/tests/Fixtures/hash-vectors.json', import.meta.url), 'utf8'));
  assert.deepEqual(saved, vectors());
});
