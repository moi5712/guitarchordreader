import { CHORD_MAP, CHORD_NAMES } from '../config/chord-config.js';
import { SCORE_CONFIG } from '../config/score-config.js';
import { chordFingerings as defaultChordFingerings } from '../chord-database.js';

// 和弦變調
export function transposeChord(chord, semitones) {
    if (!chord) return chord;
    const m = chord.match(/^([A-G][#b]?)(.*)$/);
    if (!m) return chord;
  
    const root = m[1];
    const rest = m[2] || '';
  
    const rootIndex = CHORD_MAP[root];
    if (rootIndex === undefined) return chord;
    const newRoot = CHORD_NAMES[(rootIndex + semitones + 12) % 12];
  
    // 若存在轉位（slash chord），同時變調斜線後的低音音名
    const slashPos = rest.indexOf('/');
    if (slashPos !== -1) {
      const pre = rest.slice(0, slashPos); // 後綴（m, dim, aug, sus, maj7...）維持不變
      const bassPart = rest.slice(slashPos + 1);
  
      const bm = bassPart.match(/^([A-G][#b]?)(.*)$/);
      if (bm) {
        const bassRoot = bm[1];
        const bassRest = bm[2] || '';
        const bassIndex = CHORD_MAP[bassRoot];
        if (bassIndex === undefined) {
          return newRoot + rest; // 低音不是音名則不處理
        }
        const newBass = CHORD_NAMES[(bassIndex + semitones + 12) % 12];
        return newRoot + pre + '/' + newBass + bassRest;
      }
    }
  
    // 非轉位和弦：僅變調主音，其餘字串保持
    return newRoot + rest;
  }
  
// 檢測大橫按
export function detectBarres(fingering, startFret, endFret) {
    const barres = [];
    const validFrets = fingering.filter(f => f > 0);
    if (validFrets.length === 0) return barres;
    
    const minFret = Math.min(...validFrets);
    if (minFret < startFret || minFret > endFret) return barres;
    
    const stringsOnMinFret = [];
    fingering.forEach((f, stringIndex) => {
      if (f === minFret) {
        stringsOnMinFret.push(stringIndex);
      }
    });
    
    if (stringsOnMinFret.length >= 2) {
      stringsOnMinFret.sort((a, b) => a - b);
      let consecutiveGroups = [];
      let currentGroup = [stringsOnMinFret[0]];
      
      for (let i = 1; i < stringsOnMinFret.length; i++) {
        const currentString = stringsOnMinFret[i];
        const prevString = stringsOnMinFret[i-1];
        
        let hasOpenStringBetween = false;
        for (let s = prevString + 1; s < currentString; s++) {
          if (fingering[s] === 0) {
            hasOpenStringBetween = true;
            break;
          }
        }
        
        if (currentString === prevString + 1 || !hasOpenStringBetween) {
          currentGroup.push(currentString);
        } else {
          if (currentGroup.length >= 2) {
            consecutiveGroups.push(currentGroup);
          }
          currentGroup = [currentString];
        }
      }
      
      if (currentGroup.length >= 2) {
        consecutiveGroups.push(currentGroup);
      }
      
      consecutiveGroups.forEach(group => {
        const groupSize = group.length;
        const span = Math.max(...group) - Math.min(...group) + 1;
        const includes1stString = group.includes(0);
        const isRealBarre = groupSize >= 3 || includes1stString || span >= 4;
        
        if (isRealBarre) {
          barres.push({
            fret: minFret,
            fromString: Math.min(...group),
            toString: Math.max(...group)
          });
        }
      });
    }
    
    return barres;
  }
  
// 創建和弦指法圖SVG
export function createChordDiagram(chord, options = {}) {
    const { 
      transposeValue = 0, 
      customChordFingerings = {}
    } = options;
    
    const transposedChord = transposeChord(chord, transposeValue);
    const fingering = customChordFingerings[transposedChord] || defaultChordFingerings[transposedChord];
  
    if (!fingering) {
      return `<span class="chord-name">${transposedChord}</span>`;
    }
  
    const validFrets = fingering.filter(f => f > 0);
    const minFret = validFrets.length > 0 ? Math.min(...validFrets) : 1;
    const maxFret = validFrets.length > 0 ? Math.max(...validFrets) : 5;
    
    let startFret, endFret, numFrets;
    if (maxFret <= 5) {
      startFret = 1;
      endFret = 5;
      numFrets = 5;
    } else {
      startFret = minFret;
      endFret = startFret + 4;
      numFrets = 5;
      
      if (endFret < maxFret) {
        endFret = maxFret;
        startFret = Math.max(1, endFret - 4);
        numFrets = endFret - startFret + 1;
      }
    }
  
    const { width, baseHeight, fretHeight, stringSpacing, fretStartY } = SCORE_CONFIG.chordDiagram;
    const height = baseHeight + (numFrets - 5) * fretHeight;
  
    let svg = `<svg width="${width}" height="${height}" class="chord-diagram" style="display: inline-block; vertical-align: top; margin: 0 2px;">`;
    svg += `<text x="${width/2-2}" y="14" text-anchor="middle" font-size="16" font-weight="bold" fill="#333" class="chord-diagram-title">${transposedChord}</text>`;//和弦文字
  
    if (startFret > 1) {
      svg += `<text x="3" y="${fretStartY + fretHeight/2 + 4}" text-anchor="middle" font-size="14" font-weight="bold" fill="#000">${startFret}</text>`;
    }
  
    for (let i = 0; i < 6; i++) {
      const x = 10 + i * stringSpacing;
      svg += `<line x1="${x}" y1="${fretStartY}" x2="${x}" y2="${fretStartY + numFrets * fretHeight}" stroke="#666" stroke-width="1"/>`;//弦(直線)
    }
  
    for (let i = 0; i <= numFrets; i++) {
      const y = fretStartY + i * fretHeight;
      const isNut = (startFret === 1 && i === 0);
      svg += `<line x1="9.5" y1="${y}" x2="${10.5 + 5 * stringSpacing}" y2="${y}" stroke="#666" stroke-width="${isNut ? 2 : 1}"/>`;//品(橫線)
    }
  
    const barres = detectBarres(fingering, startFret, endFret);
    barres.forEach(barre => {
      const y = fretStartY + (barre.fret - startFret + 0.53) * fretHeight;
      const x1 = 10 + barre.fromString * stringSpacing;
      const x2 = 10 + barre.toString * stringSpacing;
      svg += `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#333" stroke-width="5.5" stroke-linecap="round" />`;//大橫按橫線
    });
  
    fingering.forEach((fret, stringIndex) => {
      const x = 10 + stringIndex * stringSpacing;
      if (fret === 0) {
        svg += `<circle cx="${x}" cy="22" r="2.75" fill="none" stroke="#333" stroke-width="1"/>`;//空弦
      } else if (fret === -1) {
        svg += `<text x="${x}" y="26" text-anchor="middle" font-size="10" font-weight="600" fill="#333">×</text>`;//不彈
      } else if (fret >= startFret && fret <= endFret) {
        const y = fretStartY + (fret - startFret + 0.53) * fretHeight;
        svg += `<circle cx="${x}" cy="${y}" r="2.75" fill="#333"/>`;//指法圓點
      }
    });
  
    svg += '</svg>';
    return svg;
  }