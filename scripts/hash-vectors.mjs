#!/usr/bin/env node
// Writes api/tests/Fixtures/hash-vectors.json: normalise and hash results from the
// JavaScript matcher. The PHP API must produce exactly the same values
// (api/tests/Unit/SpoilerHasherTest.php), and scripts/hash-vectors.test.mjs keeps this file current.
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { normalize, hashPhrase } = require('../packages/matcher/src/matcher.js');

export const inputs = [
  'GTA 6 ending',
  "GTA-6's ÉNDING!!",
  'The PURPLE llama',
  '  spaced   out\ttext\n',
  'Café crème brûlée',
  'İstanbul Straße',
  'ΟΔΥΣΣΕΑΣ ΣΑΣ',
  'Ω 😭 emoji 🎮 #GTA6',
  '東京 ドリフト',
  'naïve coöperation',
  'ﬁnal ﬂight ①②',
  'x',
  '',
];
export const seeds = [0, 1, 1868958191, 2147483647];

export function vectors() {
  return inputs.flatMap((input) => seeds.map((seed) => ({ input, seed, normalized: normalize(input), hash: hashPhrase(input, seed) })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const target = new URL('../api/tests/Fixtures/hash-vectors.json', import.meta.url);
  writeFileSync(target, JSON.stringify(vectors(), null, 2) + '\n');
  console.log(`wrote ${fileURLToPath(target)}`);
}
