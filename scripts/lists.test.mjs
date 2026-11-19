// Checks the real spoiler lists against data/fixtures/titles.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('../packages/matcher/src/matcher.js');

const bundle = JSON.parse(await readFile(new URL('../extension/data/bundle.json', import.meta.url), 'utf8'));
const fixtures = JSON.parse(await readFile(new URL('../data/fixtures/titles.json', import.meta.url), 'utf8'));

test('built lists compile', () => {
  assert.ok(compile(bundle).activeTermCount > 0);
});

for (const title of fixtures.hidden) {
  test(`hidden before finishing: ${title}`, () => {
    assert.equal(compile(bundle, { progress: 0 }).match(title).isSpoiler, true);
  });
}

for (const title of fixtures.visible) {
  test(`never hidden: ${title}`, () => {
    assert.equal(compile(bundle, { progress: 0 }).match(title).isSpoiler, false);
  });
}

test('everything is visible after finishing the story', () => {
  const done = compile(bundle, { progress: bundle.chapters.length });
  for (const title of fixtures.hidden) assert.equal(done.match(title).isSpoiler, false, title);
});
