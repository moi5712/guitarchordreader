/**
 * UG (Ultimate Guitar) to ChordPro format converter.
 * Ported from chordpro/src/App.tsx — no external dependencies.
 */

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

function mergeChordsAndLyrics(chordLine, lyricLine) {
  const chords = [];
  const re = /\S+/g;
  let m;
  while ((m = re.exec(chordLine)) !== null) {
    const name = m[0]
      .replace(/([A-G])b/g, '$1♭')
      .replace(/b(\d+)/g, '♭$1');
    chords.push({ name, index: m.index });
  }

  // Pad lyric so trailing chords have a position to anchor to
  let padded = lyricLine;
  const last = chords[chords.length - 1];
  if (last && last.index > padded.length) {
    padded = padded.padEnd(last.index, ' ');
  }

  let offset = 0;
  let merged = padded;
  for (const chord of chords) {
    const pos = chord.index + offset;
    merged = merged.slice(0, pos) + `[${chord.name}]` + merged.slice(pos);
    offset += chord.name.length + 2;
  }

  // Normalise whitespace and collapse spaces between adjacent chords
  return merged.replace(/\s+/g, ' ').trim().replace(/\]\s+\[/g, '][');
}

/**
 * Convert a UG-style text block (chord line above lyric line) to ChordPro.
 * Only converts the body — meta lines (`#…` / `@…`) must be stripped before
 * calling and re-attached afterwards.
 *
 * @param {string} input Raw UG text
 * @returns {string} ChordPro formatted text
 */
export function convertUGToChordPro(input) {
  const lines = input.split('\n').map(l => l.replace(/\t/g, '    '));
  const output = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isChordLine(line)) {
      const next = lines[i + 1];
      // Merge chord line with the following lyric line when applicable
      if (next !== undefined && next.trim() !== '' && !isChordLine(next) && !next.trim().startsWith('[')) {
        output.push(mergeChordsAndLyrics(line, next));
        i++; // Skip consumed lyric line
      } else {
        // Standalone chord line (intro / interlude)
        output.push(mergeChordsAndLyrics(line, ''));
      }
    } else {
      let out = line.trim() === '' ? '' : line.trimEnd();
      // Normalise section headers: [Chorus1] → [Chorus]
      if (out.startsWith('[') && out.endsWith(']')) {
        out = out.replace(/\[([A-Za-z-]+)\s*\d+\]/, '[$1]');
        // Ensure a blank line precedes each section header
        if (output.length > 0 && output[output.length - 1] !== '') {
          output.push('');
        }
      }
      output.push(out);
    }
  }

  // Remove consecutive blank lines
  return output
    .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
    .join('\n')
    .trim();
}
