export type Kind = 'game' | 'show' | 'film' | 'book' | 'other';
export type Unit = 'chapter' | 'episode' | 'season' | 'part' | 'book' | 'act';

export interface Chapter {
  /** 1, 2, 3, ... in story order */
  id: number;
  /** plain title; use titleEncoded instead to keep a late chapter's name out of sight */
  title?: string;
  /** base64 of the title (see encodeTitle) */
  titleEncoded?: string;
  /** true while the real chapter name is not known yet */
  placeholder?: boolean;
}

export interface Rule {
  /** lower-case letters, numbers and dashes, unique within the bundle */
  id: string;
  /** chapter where the spoiler happens, or "last" for the final chapter */
  chapter: number | 'last';
  /** plain phrases, matched as whole words after normalisation */
  terms?: string[];
  /** hashed phrases from hashPhrase(), so the list itself isn't readable */
  hashes?: string[];
  /** only match when the text also mentions one of the bundle's topics (default true) */
  requiresTopic?: boolean;
  /** free-form note for reviewers; ignored by the matcher */
  note?: string;
}

export interface Bundle {
  schemaVersion: 1;
  game: { id?: string; name: string; kind?: Kind; unit?: Unit; [key: string]: unknown };
  /** phrases that show a text is about this story, e.g. "gta 6" */
  topics?: string[];
  /** phrases removed before matching, e.g. "no spoilers" */
  safePhrases?: string[];
  /** seed for hashed rules; required when any rule has hashes */
  hashSeed?: number;
  chapters: Chapter[];
  rules: Rule[];
  [key: string]: unknown;
}

export interface Catalog {
  catalogVersion: 1;
  listVersion?: string;
  packs: Bundle[];
  [key: string]: unknown;
}

export interface MatchResult {
  isSpoiler: boolean;
  /** earliest chapter the text spoils, or null */
  chapter: number | null;
  ruleIds: string[];
}

export interface Matcher {
  match(text: string): MatchResult;
  progress: number;
  chapterCount: number;
  activeTermCount: number;
}

export interface CompileOptions {
  /** chapters the reader has finished, from 0 to chapters.length */
  progress?: number;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export const SCHEMA_VERSION: 1;
export const CATALOG_VERSION: 1;
export const KINDS: Kind[];
export const UNITS: Unit[];
export const LIMITS: {
  maxTermWords: number;
  minTermLength: number;
  maxTermLength: number;
  maxTotalTerms: number;
  maxChapters: number;
  maxPacks: number;
};

export function normalize(input: unknown): string;
export function tokenize(input: unknown): string[];
/** "<word count>:<14 hex digits>", the format stored in Rule.hashes */
export function hashPhrase(phrase: string, seed: number): string;
export function encodeTitle(title: string): string;
export function chapterTitle(chapter: Chapter): string;
export function validateBundle(bundle: unknown): ValidationResult;
export function validateCatalog(catalog: unknown): ValidationResult;
export function compile(bundle: Bundle, options?: CompileOptions): Matcher;
