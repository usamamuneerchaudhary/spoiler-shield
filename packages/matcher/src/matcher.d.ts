export interface Chapter {
  /** 1, 2, 3, ... in story order */
  id: number;
  title: string;
  /** true while the real chapter name is not known yet */
  placeholder?: boolean;
}

export interface Rule {
  /** lower-case letters, numbers and dashes, unique within the bundle */
  id: string;
  /** chapter where the spoiler happens, or "last" for the final chapter */
  chapter: number | 'last';
  /** plain phrases, matched as whole words after normalisation */
  terms: string[];
  /** only match when the text also mentions one of the bundle's topics (default true) */
  requiresTopic?: boolean;
  /** free-form note for reviewers; ignored by the matcher */
  note?: string;
}

export interface Bundle {
  schemaVersion: 1;
  game: { id?: string; name: string };
  /** phrases that show a text is about this story, e.g. "gta 6" */
  topics?: string[];
  /** phrases removed before matching, e.g. "no spoilers" */
  safePhrases?: string[];
  chapters: Chapter[];
  rules: Rule[];
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

export const SCHEMA_VERSION: 1;
export const LIMITS: {
  maxTermWords: number;
  minTermLength: number;
  maxTermLength: number;
  maxTotalTerms: number;
  maxChapters: number;
};

export function normalize(input: unknown): string;
export function tokenize(input: unknown): string[];
export function validateBundle(bundle: unknown): { ok: boolean; errors: string[] };
export function compile(bundle: Bundle, options?: CompileOptions): Matcher;
