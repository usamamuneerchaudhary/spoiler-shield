// Checks the real spoiler lists: the built catalog, and every pack against data/fixtures/titles.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks, matcher } from './lib/packs.mjs';

const catalog = JSON.parse(await readFile(new URL('../extension/data/catalog.json', import.meta.url), 'utf8'));
const fixtures = JSON.parse(await readFile(new URL('../data/fixtures/titles.json', import.meta.url), 'utf8'));
const { packs, problems } = await loadPacks();

test('source lists have no problems', () => {
  assert.deepEqual(problems, []);
});

test('built catalog is valid and matches the sources', () => {
  assert.deepEqual(matcher.validateCatalog(catalog).errors, []);
  assert.deepEqual(
    catalog.packs.map((pack) => pack.game.id),
    packs.map((pack) => pack.id)
  );
});

test('every pack has regression titles', () => {
  for (const { id } of packs) assert.ok(fixtures.packs[id], `add titles for "${id}" to data/fixtures/titles.json`);
});

for (const pack of catalog.packs) {
  const titles = fixtures.packs[pack.game.id] || { hidden: [], visible: [] };
  const start = matcher.compile(pack, { progress: 0 });
  const done = matcher.compile(pack, { progress: pack.chapters.length });

  for (const title of titles.hidden) {
    test(`${pack.game.id}: hidden before finishing: ${title}`, () => {
      assert.equal(start.match(title).isSpoiler, true);
      assert.equal(done.match(title).isSpoiler, false, 'visible after finishing');
    });
  }
  for (const title of titles.visible) {
    test(`${pack.game.id}: never hidden: ${title}`, () => {
      assert.equal(start.match(title).isSpoiler, false);
    });
  }
}

test('a pack only reacts to its own topics', () => {
  const gta = matcher.compile(catalog.packs.find((pack) => pack.game.id === 'gta6'));
  assert.equal(gta.match('Stranger Things ending explained').isSpoiler, false);
});
