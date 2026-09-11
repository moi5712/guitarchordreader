import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, FileText, Music, ArrowRight, AlignHorizontalJustifyCenter, AlertTriangle } from 'lucide-react';
import { autoAlignChords, detectAlignmentIssues, type AlignmentIssue } from './lib/alignLyrics';

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length === 0 || tokens[0] === '') return false;
  
  const chordRegex = /^[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|-|\+)?\d*([#b]\d+)?(sus\d+)?(\/[A-G][#b]?)?$/;
  
  let chordCount = 0;
  for (const token of tokens) {
    const cleanToken = token.replace(/[()]/g, '');
    if (chordRegex.test(cleanToken) || cleanToken.toUpperCase() === 'N.C.') {
      chordCount++;
    }
  }
  
  // If more than 60% of the words are valid chords, we consider it a chord line
  return chordCount / tokens.length >= 0.6;
}

function mergeChordsAndLyrics(chordLine: string, lyricLine: string, autoAlign = false): string {
  const chords: {name: string, index: number}[] = [];
  const regex = /\S+/g;
  let match;
  while ((match = regex.exec(chordLine)) !== null) {
    let chordName = match[0].replace(/([A-G])b/g, '$1♭').replace(/b(\d+)/g, '♭$1');
    chords.push({ name: chordName, index: match.index });
  }

  const alignedChords = autoAlign && lyricLine.trim()
    ? autoAlignChords(chords, lyricLine).chords
    : chords;
  
  let paddedLyric = lyricLine;
  const lastChord = chords[chords.length - 1];
  if (lastChord && lastChord.index > paddedLyric.length) {
    paddedLyric = paddedLyric.padEnd(lastChord.index, ' ');
  }

  let offset = 0;
  let mergedLine = paddedLyric;
  
  for (const chord of alignedChords) {
    const insertPos = chord.index + offset;
    mergedLine = mergedLine.slice(0, insertPos) + `[${chord.name}]` + mergedLine.slice(insertPos);
    offset += chord.name.length + 2;
  }
  
  // Clean up multiple spaces
  let result = mergedLine.replace(/\s+/g, ' ').trim();
  // Remove spaces between consecutive chords to match standard ChordPro formatting
  result = result.replace(/\]\s+\[/g, '][');
  
  return result;
}

function convertToChordPro(input: string, autoAlign = false): string {
  // Replace tabs with spaces to ensure visual alignment indices are correct
  const lines = input.split('\n').map(l => l.replace(/\t/g, '    '));
  const output: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (isChordLine(line)) {
      // Check if the next line is lyrics
      if (i + 1 < lines.length && lines[i+1].trim() !== '' && !isChordLine(lines[i+1]) && !lines[i+1].trim().startsWith('[')) {
        const merged = mergeChordsAndLyrics(line, lines[i+1], autoAlign);
        output.push(merged);
        i++; // Skip the lyric line since we merged it
      } else {
        // Standalone chord line (e.g., instrumental sections)
        const merged = mergeChordsAndLyrics(line, '');
        output.push(merged);
      }
    } else {
      let outLine = line.trim() === '' ? '' : line.trimEnd();
      // Clean up section headers like [Chorus1] -> [Chorus]
      if (outLine.startsWith('[') && outLine.endsWith(']')) {
        outLine = outLine.replace(/\[([A-Za-z-]+)\s*\d+\]/, '[$1]');
        // Ensure empty line before section headers
        if (output.length > 0 && output[output.length - 1] !== '') {
          output.push('');
        }
      }
      output.push(outLine);
    }
  }
  
  // Remove consecutive empty lines and trim leading/trailing whitespace
  return output.filter((line, index, arr) => {
    if (line !== '') return true;
    if (index > 0 && arr[index - 1] !== '') return true;
    return false;
  }).join('\n').trim();
}

function collectAlignmentIssues(input: string): AlignmentIssue[] {
  const lines = input.split('\n').map(l => l.replace(/\t/g, '    '));
  const issues: AlignmentIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isChordLine(line)) continue;

    const next = lines[i + 1];
    if (!next || next.trim() === '' || isChordLine(next) || next.trim().startsWith('[')) continue;

    const chords: { name: string; index: number }[] = [];
    const regex = /\S+/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
      chords.push({ name: match[0], index: match.index });
    }

    issues.push(...detectAlignmentIssues(chords, next));
    i++;
  }

  return issues;
}

const DEFAULT_INPUT = `[Chorus1]
     Cm        Eb/Bb      Ab         Eb
Let it be, let it be, let it be, let it be
Eb               Bb             Ab Eb/G Fm Eb
Whisper words of wisdom, let it be



[Verse 2]
     Cm         Eb/Bb      Ab         Eb
And when the broken hearted people living in the world agree
Eb               Bb             Ab Eb/G Fm Eb
There will be an answer, let it be`;

export default function App() {
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoAlign, setAutoAlign] = useState(true);

  const alignmentIssues = useMemo(() => collectAlignmentIssues(input), [input]);

  useEffect(() => {
    setOutput(convertToChordPro(input, autoAlign));
  }, [input, autoAlign]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans text-neutral-900">
      <header className="bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-sm">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight leading-tight">UG to ChordPro</h1>
            <p className="text-xs text-neutral-500">Convert Ultimate Guitar tabs to ChordPro format</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-neutral-600">
          <input
            type="checkbox"
            checked={autoAlign}
            onChange={(e) => setAutoAlign(e.target.checked)}
            className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500/30"
          />
          <AlignHorizontalJustifyCenter className="w-4 h-4" />
          <span>自動對齊音節（英文／羅馬字）</span>
        </label>
      </header>

      {alignmentIssues.length > 0 && (
        <div className="mx-4 lg:mx-6 -mt-2 mb-2 max-w-[1800px] w-full self-center">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              偵測到 {alignmentIssues.length} 處可能未對齊音節
              {autoAlign ? '（已自動修正）' : '（可開啟自動對齊）'}
            </div>
            <ul className="space-y-1 text-amber-700 font-mono text-xs">
              {alignmentIssues.slice(0, 5).map((issue, idx) => (
                <li key={`${issue.chord}-${issue.originalIndex}-${idx}`}>
                  [{issue.chord}] 「{issue.lyricContext}」
                  {issue.reason === 'consonant-vowel' ? ' — 子音/母音被切開' : ' — 不在音節邊界'}
                  {autoAlign && issue.correctedIndex !== issue.originalIndex && (
                    <span className="text-amber-600"> → 偏移 {issue.correctedIndex - issue.originalIndex > 0 ? '+' : ''}{issue.correctedIndex - issue.originalIndex}</span>
                  )}
                </li>
              ))}
              {alignmentIssues.length > 5 && (
                <li className="text-amber-600">…還有 {alignmentIssues.length - 5} 處</li>
              )}
            </ul>
          </div>
        </div>
      )}

      <main className="flex-1 p-4 lg:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-[1800px] mx-auto w-full">
        {/* Input Section */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-100/50 border-b border-neutral-200 px-4 py-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-500" />
            <h2 className="font-medium text-sm text-neutral-700">Ultimate Guitar Format (Input)</h2>
          </div>
          <textarea
            className="flex-1 w-full p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-sm leading-relaxed whitespace-pre"
            placeholder="Paste your Ultimate Guitar chords here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
          />
        </div>

        {/* Desktop Divider */}
        <div className="hidden lg:flex items-center justify-center text-neutral-300">
          <ArrowRight className="w-6 h-6" />
        </div>

        {/* Output Section */}
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-neutral-100/50 border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-neutral-500" />
              <h2 className="font-medium text-sm text-neutral-700">ChordPro Format (Output)</h2>
            </div>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-neutral-200 rounded-md hover:bg-neutral-50 hover:text-blue-600 transition-colors shadow-sm"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <textarea
            className="flex-1 w-full p-4 resize-none focus:outline-none bg-neutral-50 font-mono text-sm leading-relaxed text-neutral-800 whitespace-pre"
            value={output}
            readOnly
            spellCheck={false}
          />
        </div>
      </main>
    </div>
  );
}
