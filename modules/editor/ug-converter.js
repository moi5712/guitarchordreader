/**
 * UG (Ultimate Guitar) to ChordPro format converter.
 * Ported from chordpro/src/App.tsx with syllable auto-align.
 */

import { autoAlignChords, detectAlignmentIssues } from './align-lyrics.js';

const CHORD_REGEX = /^[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|-|\+)?\d*([#b]\d+)?(sus\d+)?(\/[A-G][#b]?)?$/;

function isChordLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === '') return false;

  let chordCount = 0;
  for (const token of tokens) {
    const clean = token.replace(/[()]/g, '');
    if (CHORD_REGEX.test(clean) || clean.toUpperCase() === 'N.C.') {
      chordCount++;
    }
  }

  return chordCount / tokens.length >= 0.6;
}

function parseChordPositions(chordLine) {
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    const name = m[0]
      .replace(/([A-G])b/g, '$1♭')
      .replace(/b(\d+)/g, '♭$1');
    chords.push({ name, index: m.index });
  }
  return chords;
}

function mergeChordsAndLyrics(chordLine, lyricLine, autoAlign = false) {
  const chords = parseChordPositions(chordLine);
  const alignedChords = autoAlign && lyricLine.trim()
    ? autoAlignChords(chords, lyricLine).chords
    : chords;

  let padded = lyricLine;
  const last = chords[chords.length - 1];
  if (last && last.index > padded.length) {
    padded = padded.padEnd(last.index, ' ');
  }

  let offset = 0;
  let merged = padded;
  for (const chord of alignedChords) {
    const pos = chord.index + offset;
    merged = merged.slice(0, pos) + `[${chord.name}]` + merged.slice(pos);
    offset += chord.name.length + 2;
  }

  return merged.replace(/\s+/g, ' ').trim().replace(/\]\s+\[/g, '][');
}

/**
 * Convert a UG-style text block (chord line above lyric line) to ChordPro.
 * Only converts the body — meta lines (`#…` / `@…`) must be stripped before
 * calling and re-attached afterwards.
 *
 * @param {string} input Raw UG text
 * @param {{ autoAlign?: boolean }} [options]
 * @returns {string} ChordPro formatted text
 */
export function convertUGToChordPro(input, options = {}) {
  const autoAlign = options.autoAlign !== false;
  const lines = input.split('\n').map(l => l.replace(/\t/g, '    '));
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isChordLine(line)) {
      const next = lines[i + 1];
      if (next !== undefined && next.trim() !== '' && !isChordLine(next) && !next.trim().startsWith('[')) {
        output.push(mergeChordsAndLyrics(line, next, autoAlign));
        i++;
      } else {
        output.push(mergeChordsAndLyrics(line, '', false));
      }
    } else {
      let out = line.trim() === '' ? '' : line.trimEnd();
      if (out.startsWith('[') && out.endsWith(']')) {
        out = out.replace(/\[([A-Za-z-]+)\s*\d+\]/, '[$1]');
        if (output.length > 0 && output[output.length - 1] !== '') {
          output.push('');
        }
      }
      output.push(out);
    }
  }

  return output
    .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
    .join('\n')
    .trim();
}

/**
 * Detect chord/lyric misalignment in UG-format input (before conversion).
 * @param {string} input
 * @returns {Array<{ chord: string, originalIndex: number, correctedIndex: number, lyricContext: string, reason: string }>}
 */
export function collectAlignmentIssues(input) {
  const lines = input.split('\n').map(l => l.replace(/\t/g, '    '));
  const issues = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isChordLine(line)) continue;

    const next = lines[i + 1];
    if (!next || next.trim() === '' || isChordLine(next) || next.trim().startsWith('[')) continue;

    issues.push(...detectAlignmentIssues(parseChordPositions(line), next));
    i++;
  }

  return issues;
}
