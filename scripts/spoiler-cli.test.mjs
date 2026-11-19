// Runs the `npm run spoiler` tool against a scratch copy of data/, so the real lists are never touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tool = path.join(repo, 'scripts/spoiler.mjs');

function scratch() {
  const root = mkdtempSync(path.join(tmpdir(), 'ss-cli-'));
  cpSync(path.join(repo, 'data'), path.join(root, 'data'), { recursive: true });
  mkdirSync(path.join(root, 'packages/matcher'), { recursive: true });
  cpSync(path.join(repo, 'packages/matcher/src'), path.join(root, 'packages/matcher/src'), { recursive: true });
  return root;
}

function run(root, args) {
  const result = spawnSync(process.execPath, [tool, ...args], { env: { ...process.env, SPOILER_SHIELD_ROOT: root }, encoding: 'utf8' });
  return { code: result.status, out: result.stdout + result.stderr };
}

test('add stores hashes, never the phrase', () => {
  const root = scratch();
  const { code, out } = run(root, ['add', 'gta6', '3', 'ch03-test', 'The Purple Llama', 'llama boss', '--note', 'spoiler-free hint']);
  assert.equal(code, 0, out);
  const file = readFileSync(path.join(root, 'data/packs/gta6/spoilers/chapter-03.json'), 'utf8');
  assert.doesNotMatch(file, /llama/i);
  const { rules } = JSON.parse(file);
  assert.equal(rules[0].id, 'ch03-test');
  assert.equal(rules[0].chapter, 3);
  assert.equal(rules[0].note, 'spoiler-free hint');
  assert.equal(rules[0].hashes.length, 2);

  // Adding the same phrase again does nothing.
  run(root, ['add', 'gta6', '3', 'ch03-test', 'the purple llama']);
  assert.equal(JSON.parse(readFileSync(path.join(root, 'data/packs/gta6/spoilers/chapter-03.json'), 'utf8')).rules[0].hashes.length, 2);
});

test('check reports whether text would be hidden', () => {
  const root = scratch();
  run(root, ['add', 'gta6', '3', 'ch03-test', 'purple llama']);
  assert.match(run(root, ['check', 'gta6', 'GTA 6: the purple llama']).out, /Hidden: spoils chapter 3/);
  assert.match(run(root, ['check', 'gta6', 'GTA 6: the purple llama', '--progress', '3']).out, /Visible/);
  assert.match(run(root, ['check', 'gta6', 'the purple llama']).out, /Visible/, 'needs the topic');
});

test('"last" goes to ending.json', () => {
  const root = scratch();
  assert.equal(run(root, ['add', 'stranger-things', 'last', 'ending-test', 'upside down forever']).code, 0);
  const { rules } = JSON.parse(readFileSync(path.join(root, 'data/packs/stranger-things/spoilers/ending.json'), 'utf8'));
  assert.equal(rules[0].chapter, 'last');
});

test('title saves an encoded chapter title', () => {
  const root = scratch();
  assert.equal(run(root, ['title', 'gta6', '2', 'Night Market']).code, 0);
  const chapter = JSON.parse(readFileSync(path.join(root, 'data/packs/gta6/chapters.json'), 'utf8')).chapters[1];
  assert.equal(chapter.placeholder, undefined);
  assert.equal(Buffer.from(chapter.titleEncoded, 'base64').toString('utf8'), 'Night Market');
});

test('new-pack scaffolds a pack the build accepts', () => {
  const root = scratch();
  assert.equal(run(root, ['new-pack', 'test-show', '--name', 'Test Show', '--kind', 'show', '--unit', 'episode', '--count', '8']).code, 0);
  const pack = JSON.parse(readFileSync(path.join(root, 'data/packs/test-show/pack.json'), 'utf8'));
  assert.equal(pack.kind, 'show');
  assert.ok(Number.isInteger(pack.hashSeed));
  assert.equal(JSON.parse(readFileSync(path.join(root, 'data/packs/test-show/chapters.json'), 'utf8')).chapters.length, 8);
  assert.ok(existsSync(path.join(root, 'data/packs/test-show/spoilers/README.md')));
  assert.match(run(root, ['list']).out, /test-show\s+Test Show: 8 episodes/);
});

test('bad input is refused with a clear message', () => {
  const root = scratch();
  assert.match(run(root, ['add', 'gta6', '9', 'x-rule', 'abc def']).out, /chapter must be "last" or a number from 1 to 6/);
  assert.match(run(root, ['add', 'gta6', '2', 'Bad Id', 'abc def']).out, /rule id must be lower-case/);
  assert.match(run(root, ['add', 'nope', '1', 'x-rule', 'abc']).out, /no pack "nope"/);
  assert.match(run(root, ['add', 'gta6', '1', 'x-rule', 'ab']).out, /too short/);
  assert.match(run(root, ['new-pack', 'gta6', '--name', 'Dup']).out, /already exists/);
  assert.notEqual(run(root, ['wat']).code, 0);
});
