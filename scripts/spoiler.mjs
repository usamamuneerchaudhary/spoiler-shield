#!/usr/bin/env node
/**
 * Spoiler list tool. Phrases are hashed before they are saved, so the files in
 * the repo never contain readable spoilers.
 *
 *   npm run spoiler -- list
 *   npm run spoiler -- add <pack> <chapter|last> <rule-id> "phrase" ["phrase" ...] [--note "spoiler-free hint"]
 *   npm run spoiler -- check <pack> "some text" [--progress N]
 *   npm run spoiler -- title <pack> <chapter> "Chapter title"
 *   npm run spoiler -- new-pack <id> --name "Name" --kind game|show|film|book|other --unit chapter|episode|season|part|book|act --count N
 */
import { randomInt } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadPacks, matcher, packDir, root, spoilerFileFor } from './lib/packs.mjs';

const ID = /^[a-z0-9][a-z0-9-]{1,63}$/;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      flags[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else {
      positional.push(argv[i]);
    }
  }
  return { positional, flags };
}

async function readJson(file, fallback) {
  return existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback;
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

async function requirePack(id) {
  if (!id) fail('name a pack, e.g. gta6 (see: npm run spoiler -- list)');
  const info = await readJson(path.join(packDir(id), 'pack.json'), null);
  if (!info) fail(`no pack "${id}" in data/packs (see: npm run spoiler -- list)`);
  const { chapters } = await readJson(path.join(packDir(id), 'chapters.json'), { chapters: [] });
  return { info, chapters };
}

function parseChapter(value, chapters) {
  if (value === 'last') return 'last';
  const chapter = Number(value);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > chapters.length) {
    fail(`chapter must be "last" or a number from 1 to ${chapters.length}`);
  }
  return chapter;
}

const commands = {
  async list() {
    const { packs, problems } = await loadPacks();
    for (const { id, bundle } of packs) {
      const hashed = bundle.rules.reduce((total, rule) => total + (rule.hashes || []).length, 0);
      const count = bundle.chapters.length;
      console.log(`${id.padEnd(22)} ${bundle.game.name}: ${count} ${bundle.game.unit}${count === 1 ? '' : 's'}, ${hashed} hashed phrases`);
    }
    if (problems.length) console.warn('\nProblems:\n- ' + problems.join('\n- '));
  },

  async add({ positional, flags }) {
    const [id, chapterArg, ruleId, ...phrases] = positional;
    const { info, chapters } = await requirePack(id);
    const chapter = parseChapter(chapterArg, chapters);
    if (!ruleId || !ID.test(ruleId)) fail('rule id must be lower-case letters, numbers and dashes, e.g. ch03-001');
    if (!phrases.length) fail('give at least one phrase in quotes');

    const hashes = phrases.map((phrase) => {
      const normalized = matcher.normalize(phrase);
      const words = normalized.split(' ').length;
      if (normalized.length < matcher.LIMITS.minTermLength) fail(`"${phrase}" is too short`);
      if (normalized.length > matcher.LIMITS.maxTermLength) fail(`"${phrase}" is too long`);
      if (words > matcher.LIMITS.maxTermWords) fail(`"${phrase}" has more than ${matcher.LIMITS.maxTermWords} words`);
      return matcher.hashPhrase(phrase, info.hashSeed);
    });

    const file = path.join(packDir(id), 'spoilers', spoilerFileFor(chapter));
    const content = await readJson(file, { rules: [] });
    let rule = content.rules.find((existing) => existing.id === ruleId);
    if (!rule) {
      rule = { id: ruleId, chapter, hashes: [] };
      content.rules.push(rule);
    }
    if (typeof flags.note === 'string') rule.note = flags.note;
    rule.hashes = rule.hashes || [];
    const before = rule.hashes.length;
    for (const hash of hashes) if (!rule.hashes.includes(hash)) rule.hashes.push(hash);
    await writeJson(file, content);

    console.log(`Added ${rule.hashes.length - before} phrase(s) to rule "${ruleId}" in ${path.relative(root, file)}.`);
    console.log('Next: npm run build && npm test, then open a pull request with a spoiler-free title.');
  },

  async check({ positional, flags }) {
    const [id, ...words] = positional;
    await requirePack(id);
    const text = words.join(' ');
    if (!text) fail('give the text to check in quotes');
    const { packs, problems } = await loadPacks();
    const pack = packs.find((entry) => entry.id === id);
    if (problems.length) fail('fix these first:\n- ' + problems.join('\n- '));
    const progress = Number(flags.progress || 0);
    const result = matcher.compile(pack.bundle, { progress }).match(text);
    if (result.isSpoiler) {
      console.log(`Hidden: spoils ${pack.bundle.game.unit} ${result.chapter} (rules: ${result.ruleIds.join(', ')}), reader progress ${progress}.`);
    } else {
      console.log(`Visible: not hidden at reader progress ${progress}.`);
    }
  },

  async title({ positional }) {
    const [id, chapterArg, ...words] = positional;
    const { chapters } = await requirePack(id);
    const chapter = parseChapter(chapterArg, chapters);
    if (chapter === 'last') fail('give the chapter number');
    const title = words.join(' ').trim();
    if (!title) fail('give the title in quotes');
    const entry = chapters[chapter - 1];
    delete entry.title;
    delete entry.placeholder;
    entry.titleEncoded = matcher.encodeTitle(title);
    await writeJson(path.join(packDir(id), 'chapters.json'), { chapters });
    console.log(`Saved the title of ${id} chapter ${chapter} (encoded, so it isn't readable in the repo).`);
  },

  async 'new-pack'({ positional, flags }) {
    const [id] = positional;
    if (!id || !ID.test(id)) fail('pack id must be lower-case letters, numbers and dashes, e.g. elden-ring');
    if (existsSync(packDir(id))) fail(`data/packs/${id} already exists`);
    const name = typeof flags.name === 'string' ? flags.name : fail('give --name "Display name"');
    const kind = flags.kind || 'game';
    const unit = flags.unit || (kind === 'show' ? 'episode' : 'chapter');
    if (!matcher.KINDS.includes(kind)) fail(`--kind must be one of ${matcher.KINDS.join(', ')}`);
    if (!matcher.UNITS.includes(unit)) fail(`--unit must be one of ${matcher.UNITS.join(', ')}`);
    const count = Number(flags.count || 1);
    if (!Number.isInteger(count) || count < 1 || count > matcher.LIMITS.maxChapters) fail('--count must be a whole number');

    const label = unit[0].toUpperCase() + unit.slice(1);
    const chapters = Array.from({ length: count }, (_, index) =>
      count === 1 ? { id: 1, title: 'The whole story', placeholder: true } : { id: index + 1, title: `${label} ${index + 1}`, placeholder: true }
    );
    await writeJson(path.join(packDir(id), 'pack.json'), {
      id,
      name,
      kind,
      unit,
      hashSeed: randomInt(1, 2147483647),
      topics: [matcher.normalize(name)],
    });
    await writeJson(path.join(packDir(id), 'chapters.json'), { chapters });
    await mkdir(path.join(packDir(id), 'spoilers'), { recursive: true });
    await writeFile(
      path.join(packDir(id), 'spoilers', 'README.md'),
      await readFile(path.join(root, 'data/packs/gta6/spoilers/README.md'), 'utf8')
    );
    console.log(`Created data/packs/${id}. Add the phrases people use for it to "topics" in pack.json, then run npm run build.`);
  },
};

const [command, ...rest] = process.argv.slice(2);
if (!command || !commands[command]) {
  console.log(
    [
      'Spoiler list tool',
      '',
      '  npm run spoiler -- list',
      '  npm run spoiler -- add <pack> <chapter|last> <rule-id> "phrase" ["phrase" ...] [--note "spoiler-free hint"]',
      '  npm run spoiler -- check <pack> "some text" [--progress N]',
      '  npm run spoiler -- title <pack> <chapter> "Chapter title"',
      '  npm run spoiler -- new-pack <id> --name "Name" [--kind show] [--unit episode] [--count 8]',
    ].join('\n')
  );
  process.exit(command ? 1 : 0);
}
await commands[command](parseArgs(rest));
