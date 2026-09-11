import { looksLikeRomaji, romajiMoraBoundaries } from './romaji-syllables.js';

const WORD_RE = /[a-zA-Z']+/g;

function isVowel(char) {
  return /[aeiouyAEIOUY]/.test(char);
}

function isConsonant(char) {
  return /[a-zA-Z]/.test(char) && !isVowel(char);
}

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
];

function morphologicalBoundaries(word) {
  const lower = word.toLowerCase();
  const bounds = [];

  for (const suffix of SUFFIX_PATTERNS) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 1) {
      bounds.push(word.length - suffix.length);
    }
  }

  return bounds;
}

/**
 * Lightweight English syllable starts (replaces the hyphenated package).
 * Nucleus = vowel cluster; next syllable typically starts at the last consonant
 * of the following cluster, keeping common onsets together.
 */
export function syllableBoundariesInWord(word) {
  const boundaries = [0];
  const isV = (c) => /[aeiouyAEIOUY]/.test(c);
  let i = 0;
  while (i < word.length && /[a-zA-Z]/.test(word[i]) && !isV(word[i])) i++;

  while (i < word.length) {
    while (i < word.length && isV(word[i])) i++;
    if (i >= word.length) break;

    const consStart = i;
    while (i < word.length && /[a-zA-Z]/.test(word[i]) && !isV(word[i])) i++;
    if (i >= word.length) break;

    const rest = word.slice(consStart).toLowerCase();
    const consLen = i - consStart;
    let onset = consLen <= 1 ? consLen : 1;
    if (/^(str|spr|scr|spl|thr|shr)/.test(rest)) onset = Math.min(consLen, 3);
    else if (/^(ch|sh|th|wh|ph|qu|tr|dr|br|cr|fr|gr|pr|bl|cl|fl|gl|pl|sl)/.test(rest)) {
      onset = Math.min(consLen, 2);
    }

    const nextStart = i - onset;
    if (nextStart > 0 && nextStart < word.length) boundaries.push(nextStart);
  }

  return [...new Set(boundaries)].sort((a, b) => a - b);
}

function allBoundariesInWord(word) {
  if (looksLikeRomaji(word)) {
    return romajiMoraBoundaries(word);
  }

  return [...new Set([
    ...syllableBoundariesInWord(word),
    ...morphologicalBoundaries(word),
  ])].sort((a, b) => a - b);
}

export function getValidAnchorPositions(lyricLine) {
  const anchors = new Set([0]);

  for (let i = 0; i < lyricLine.length; i++) {
    if (lyricLine[i] === ' ') {
      anchors.add(i + 1);
    }
  }

  WORD_RE.lastIndex = 0;
  let match;
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

function getWordAt(lyricLine, pos) {
  WORD_RE.lastIndex = 0;
  let match;
  while ((match = WORD_RE.exec(lyricLine)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (pos >= start && pos < end) {
      return { word: match[0], start };
    }
  }
  return null;
}

function isOnSyllableBoundary(lyricLine, pos) {
  const wordInfo = getWordAt(lyricLine, pos);
  if (!wordInfo) return true;
  const relPos = pos - wordInfo.start;
  if (relPos === 0) return true;
  return allBoundariesInWord(wordInfo.word).includes(relPos);
}

export function isConsonantVowelSplit(lyricLine, pos) {
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

export function isMisaligned(lyricLine, pos, anchors) {
  if (anchors.has(pos)) return false;
  if (pos <= 0 || pos >= lyricLine.length) return false;

  const at = lyricLine[pos];
  const before = lyricLine[pos - 1];
  if (!/[a-zA-Z]/.test(at) || !/[a-zA-Z]/.test(before)) return false;

  return true;
}

function snapToNearestAnchor(pos, lyricLine, anchors, maxOffset = 2) {
  if (anchors.has(pos)) return pos;

  const candidates = [];
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

function lyricContext(lyricLine, pos, radius = 4) {
  const start = Math.max(0, pos - radius);
  const end = Math.min(lyricLine.length, pos + radius);
  const snippet = lyricLine.slice(start, end);
  const markerPos = pos - start;
  return snippet.slice(0, markerPos) + '|' + snippet.slice(markerPos);
}

export function autoAlignChords(chords, lyricLine, maxOffset = 2) {
  const anchors = getValidAnchorPositions(lyricLine);
  const issues = [];

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

export function detectAlignmentIssues(chords, lyricLine) {
  const anchors = getValidAnchorPositions(lyricLine);
  const issues = [];

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
