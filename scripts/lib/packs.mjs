// Reads data/ into one bundle per pack. Shared by build.mjs, spoiler.mjs and the tests.
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// SPOILER_SHIELD_ROOT lets the tests point the tools at a scratch copy of the repo.
export const root = process.env.SPOILER_SHIELD_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const matcher = require(path.join(root, 'packages/matcher/src/matcher.js'));

const SPOILER_FILE = /^(?:chapter-(\d{2,3})|ending)\.json$/;

export function packDir(id) {
  return path.join(root, 'data/packs', id);
}

export function spoilerFileFor(chapter) {
  return chapter === 'last' ? 'ending.json' : `chapter-${String(chapter).padStart(2, '0')}.json`;
}

async function readJson(file, problems) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    problems.push(`${path.relative(root, file)}: ${error.message}`);
    return null;
  }
}

/**
 * Load every pack. Returns { packs: [{ id, dir, bundle }], problems: [] }.
 * `problems` lists everything wrong with the source files, in plain words.
 */
export async function loadPacks() {
  const problems = [];
  const shared = await readJson(path.join(root, 'data/shared/generic.json'), problems);
  const packsRoot = path.join(root, 'data/packs');
  const ids = (await readdir(packsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const packs = [];
  for (const id of ids) {
    const dir = packDir(id);
    const where = `data/packs/${id}`;
    const info = await readJson(path.join(dir, 'pack.json'), problems);
    const chapters = await readJson(path.join(dir, 'chapters.json'), problems);
    if (!info || !chapters || !shared) continue;
    if (info.id !== id) problems.push(`${where}/pack.json: "id" must be "${id}" (the folder name)`);

    const rules = [...(shared.rules || [])];
    const spoilerDir = path.join(dir, 'spoilers');
    const files = existsSync(spoilerDir) ? (await readdir(spoilerDir)).filter((name) => name.endsWith('.json')).sort() : [];
    for (const name of files) {
      const content = await readJson(path.join(spoilerDir, name), problems);
      if (!content) continue;
      const fileMatch = SPOILER_FILE.exec(name);
      if (!fileMatch) {
        problems.push(`${where}/spoilers/${name}: name it "chapter-NN.json" or "ending.json"`);
        continue;
      }
      if (!Array.isArray(content.rules)) {
        problems.push(`${where}/spoilers/${name}: must contain a "rules" array`);
        continue;
      }
      const expected = fileMatch[1] ? Number(fileMatch[1]) : 'last';
      for (const rule of content.rules) {
        if (rule.chapter !== expected) {
          problems.push(`${where}/spoilers/${name}: rule "${rule.id}" has chapter ${JSON.stringify(rule.chapter)} but belongs to ${JSON.stringify(expected)}`);
        }
        rules.push(rule);
      }
    }

    // The same phrase in two rules makes one of them pointless.
    const owners = new Map();
    for (const rule of rules) {
      const keys = [
        ...(rule.terms || []).map((term) => matcher.hashPhrase(term, info.hashSeed || 0)),
        ...(rule.hashes || []),
      ];
      for (const key of keys) {
        if (owners.has(key) && owners.get(key) !== rule.id) {
          problems.push(`${where}: a phrase in rule "${rule.id}" is already in rule "${owners.get(key)}"`);
        } else {
          owners.set(key, rule.id);
        }
      }
    }

    const bundle = {
      schemaVersion: matcher.SCHEMA_VERSION,
      game: { id: info.id, name: info.name, kind: info.kind, unit: info.unit },
      topics: info.topics,
      safePhrases: shared.safePhrases,
      hashSeed: info.hashSeed,
      chapters: chapters.chapters,
      rules,
    };
    const check = matcher.validateBundle(bundle);
    problems.push(...check.errors.map((error) => `${where}: ${error}`));
    packs.push({ id, dir, bundle });
  }

  if (!packs.length && !problems.length) problems.push('data/packs has no packs');
  return { packs, problems };
}
