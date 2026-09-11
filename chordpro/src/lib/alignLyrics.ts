import { hyphenated } from 'hyphenated';
import { looksLikeRomaji, romajiMoraBoundaries } from './romajiSyllables';

const SOFT_HYPHEN = '\u00AD';
const WORD_RE = /[a-zA-Z']+/g;

export interface ChordPosition {
  name: string;
  index: number;
}

export interface AlignmentIssue {
  chord: string;
  originalIndex: number;
  correctedIndex: number;
  lyricContext: string;
  reason: 'syllable' | 'consonant-vowel';
}

function isVowel(char: string): boolean {
  return /[aeiouyAEIOUY]/.test(char);
}

function isConsonant(char: string): boolean {
  return /[a-zA-Z]/.test(char) && !isVowel(char);
}

/** Common suffixes where the boundary before the suffix is a valid chord anchor. */
const SUFFIX_PATTERNS = [
  'isations', 'izations', 'isation', 'ization',
  'ised', 'ized', 'ising', 'izing',
  'ingly', 'edly', 'ally', 'fully', 'ily',
  'ments', 'ness', 'ment', 'tion', 'sion',
  'able', 'ible', 'ful', 'less', 'ous', 'ive', 'ity',
  'ance', 'ence', 'ancy', 'ency',
  'ward', 'wise',
  'iest', 'ier',
  'ated', 'ates', 'ating', 'ate',
  'ical', 'ial', 'ual', 'ish', 'ism', 'ist',
  'ary', 'ery', 'ory',
  'ant', 'ent',
  'est', 'er',
  'al', 'ic',
  'ty',
  'ing', 'ed', 'ly',
] as const;

/** Morphological break points (e.g. Real|ised, realiz|ing). */
function morphologicalBoundaries(word: string): number[] {
  const lower = word.toLowerCase();
  const bounds: number[] = [];

  for (const suffix of SUFFIX_PATTERNS) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 1) {
      bounds.push(word.length - suffix.length);
    }
  }

  return bounds;
}

function allBoundariesInWord(word: string): number[] {
  if (looksLikeRomaji(word)) {
    return romajiMoraBoundaries(word);
  }

  return [...new Set([
    ...syllableBoundariesInWord(word),
    ...morphologicalBoundaries(word),
  ])].sort((a, b) => a - b);
}

/** Extract syllable-start offsets within a single word (0 = word start). */
export function syllableBoundariesInWord(word: string): number[] {
  const h = hyphenated(word);
  const boundaries = [0];
  let origIdx = 0;

  for (let i = 0; i < h.length; i++) {
    if (h[i] === SOFT_HYPHEN) {
      boundaries.push(origIdx);
      continue;
    }
    origIdx++;
  }

  return boundaries;
}

/** All valid anchor positions in a lyric line (word starts + syllable starts). */
export function getValidAnchorPositions(lyricLine: string): Set<number> {
  const anchors = new Set<number>([0]);

  for (let i = 0; i < lyricLine.length; i++) {
    if (lyricLine[i] === ' ') {
      anchors.add(i + 1);
    }
  }

  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(lyricLine)) !== null) {
    const word = match[0];
    const start = match.index;
    anchors.add(start);
    for (const offset of allBoundariesInWord(word)) {
      if (offset > 0) {
        anchors.add(start + offset);
      }
    }
  }

  return anchors;
}

function getWordAt(lyricLine: string, pos: number): { word: string; start: number } | null {
  WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WORD_RE.exec(lyricLine)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (pos >= start && pos < end) {
      return { word: match[0], start };
    }
  }
  return null;
}

function isOnSyllableBoundary(lyricLine: string, pos: number): boolean {
  const wordInfo = getWordAt(lyricLine, pos);
  if (!wordInfo) return true;
  const relPos = pos - wordInfo.start;
  if (relPos === 0) return true;
  return allBoundariesInWord(wordInfo.word).includes(relPos);
}

/** Detect if a chord splits a consonant from its syllable vowel (common UG misalignment). */
export function isConsonantVowelSplit(lyricLine: string, pos: number): boolean {
  if (pos <= 0 || pos >= lyricLine.length) return false;

  const wordInfo = getWordAt(lyricLine, pos);
  if (wordInfo && looksLikeRomaji(wordInfo.word)) {
    return false;
  }

  const before = lyricLine[pos - 1];
  const at = lyricLine[pos];
  if (!isConsonant(before) || !isVowel(at)) return false;

  return !isOnSyllableBoundary(lyricLine, pos);
}

export function isMisaligned(lyricLine: string, pos: number, anchors: Set<number>): boolean {
  if (anchors.has(pos)) return false;
  if (pos <= 0 || pos >= lyricLine.length) return false;

  const at = lyricLine[pos];
  const before = lyricLine[pos - 1];
  if (!/[a-zA-Z]/.test(at) || !/[a-zA-Z]/.test(before)) return false;

  return true;
}

function snapToNearestAnchor(
  pos: number,
  lyricLine: string,
  anchors: Set<number>,
  maxOffset = 2,
): number {
  if (anchors.has(pos)) return pos;

  const candidates: number[] = [];
  for (let delta = 1; delta <= maxOffset; delta++) {
    if (anchors.has(pos - delta)) candidates.push(pos - delta);
    if (anchors.has(pos + delta)) candidates.push(pos + delta);
  }
  if (candidates.length === 0) return pos;

  const wordInfo = getWordAt(lyricLine, pos);
  if (wordInfo) {
    const wordEnd = wordInfo.start + wordInfo.word.length;
    const syllableStarts = allBoundariesInWord(wordInfo.word).map(
      (offset) => wordInfo.start + offset,
    );

    const inWordSyllable = candidates.filter(
      (c) => c >= wordInfo.start && c < wordEnd && syllableStarts.includes(c),
    );

    if (inWordSyllable.length > 0) {
      const preferForward = isConsonantVowelSplit(lyricLine, pos);
      inWordSyllable.sort((a, b) => {
        const distA = Math.abs(a - pos);
        const distB = Math.abs(b - pos);
        if (distA !== distB) return distA - distB;
        if (preferForward) return b - a;
        return a - b;
      });
      return inWordSyllable[0];
    }
  }

  return candidates.reduce((best, c) =>
    Math.abs(c - pos) < Math.abs(best - pos) ? c : best,
  );
}

function lyricContext(lyricLine: string, pos: number, radius = 4): string {
  const start = Math.max(0, pos - radius);
  const end = Math.min(lyricLine.length, pos + radius);
  const snippet = lyricLine.slice(start, end);
  const markerPos = pos - start;
  return snippet.slice(0, markerPos) + '|' + snippet.slice(markerPos);
}

/** Snap chord positions to nearest syllable/word boundaries. */
export function autoAlignChords(
  chords: ChordPosition[],
  lyricLine: string,
  maxOffset = 2,
): { chords: ChordPosition[]; issues: AlignmentIssue[] } {
  const anchors = getValidAnchorPositions(lyricLine);
  const issues: AlignmentIssue[] = [];

  const aligned = chords.map((chord) => {
    const original = chord.index;
    if (!isMisaligned(lyricLine, original, anchors)) {
      return chord;
    }

    const corrected = snapToNearestAnchor(original, lyricLine, anchors, maxOffset);
    if (corrected !== original) {
      issues.push({
        chord: chord.name,
        originalIndex: original,
        correctedIndex: corrected,
        lyricContext: lyricContext(lyricLine, original),
        reason: isConsonantVowelSplit(lyricLine, original) ? 'consonant-vowel' : 'syllable',
      });
    }

    return { ...chord, index: corrected };
  });

  for (let i = 1; i < aligned.length; i++) {
    if (aligned[i].index <= aligned[i - 1].index) {
      aligned[i] = { ...aligned[i], index: aligned[i - 1].index + 1 };
    }
  }

  return { chords: aligned, issues };
}

/** Scan without correcting — useful for warnings in the UI. */
export function detectAlignmentIssues(
  chords: ChordPosition[],
  lyricLine: string,
): AlignmentIssue[] {
  const anchors = getValidAnchorPositions(lyricLine);
  const issues: AlignmentIssue[] = [];

  for (const chord of chords) {
    if (!isMisaligned(lyricLine, chord.index, anchors)) continue;

    const corrected = snapToNearestAnchor(chord.index, lyricLine, anchors);
    issues.push({
      chord: chord.name,
      originalIndex: chord.index,
      correctedIndex: corrected,
      lyricContext: lyricContext(lyricLine, chord.index),
      reason: isConsonantVowelSplit(lyricLine, chord.index) ? 'consonant-vowel' : 'syllable',
    });
  }

  return issues;
}
