const VOWELS = 'aeiou';

/** Hepburn-style multi-char onsets (longest match first). */
const ONSETS = [
  'kya', 'kyu', 'kyo', 'gya', 'gyu', 'gyo',
  'sha', 'shi', 'shu', 'she', 'sho',
  'cha', 'chi', 'chu', 'che', 'cho',
  'nya', 'nyu', 'nyo', 'hya', 'hyu', 'hyo',
  'mya', 'myu', 'myo', 'rya', 'ryu', 'ryo',
  'bya', 'byu', 'byo', 'pya', 'pyu', 'pyo',
  'ja', 'ji', 'ju', 'je', 'jo',
  'fa', 'fi', 'fu', 'fe', 'fo',
  'tsu', 'la', 'li', 'lu', 'le', 'lo',
  'wha', 'whi', 'whe', 'who',
  'ka', 'ki', 'ku', 'ke', 'ko',
  'ga', 'gi', 'gu', 'ge', 'go',
  'sa', 'su', 'se', 'so',
  'za', 'zi', 'zu', 'ze', 'zo',
  'ta', 'te', 'to',
  'da', 'di', 'du', 'de', 'do',
  'na', 'ni', 'nu', 'ne', 'no',
  'ha', 'hi', 'hu', 'he', 'ho',
  'ba', 'bi', 'bu', 'be', 'bo',
  'pa', 'pi', 'pu', 'pe', 'po',
  'ma', 'mi', 'mu', 'me', 'mo',
  'ra', 'ri', 'ru', 're', 'ro',
  'wa', 'wi', 'we', 'wo',
  'ya', 'yu', 'yo',
  'va', 'vi', 'vu', 've', 'vo',
];

const ENGLISH_MARKERS =
  /th|gh|ck|tion|sion|ough|ight|ould|ious|eous|ture|ea|ee|oa|ie|ue|ph|sch|str|spr|scr|squ/i;

const ENGLISH_SUFFIX =
  /(?:isations?|izations?|ingly|edly|ally|fully|ily|ments?|ness|tion|sion|able|ible|ful|less|ous|ive|ity|ance|ence|ancy|ency|ward|wise|iest|ier|ated|ates|ating|ate|ical|ial|ual|ish|ism|ist|ary|ery|ory|ant|ent|est|er|al|ic|ty|ing|ed|ly|ised|ized|ising|izing)$/i;

function isConsonantChar(c) {
  return /[bcdfghjklmnpqrstvwxyz]/.test(c);
}

function extendLongVowel(s, i, vowel) {
  let j = i;
  if (j < s.length && s[j] === vowel) {
    j++;
  } else if (vowel === 'o' && j < s.length && s[j] === 'u') {
    j++;
  } else if (vowel === 'e' && j < s.length && s[j] === 'i') {
    j++;
  }
  return j;
}

function consumeMora(s, i) {
  if (i >= s.length) return i;

  if (
    i + 2 < s.length &&
    s[i] === s[i + 1] &&
    isConsonantChar(s[i]) &&
    VOWELS.includes(s[i + 2])
  ) {
    const vowel = s[i + 2];
    return extendLongVowel(s, i + 3, vowel);
  }

  if (s[i] === 'n') {
    if (i + 1 >= s.length || s[i + 1] === "'") return i + 1;
    if (s[i + 1] === 'n' && (i + 2 >= s.length || !VOWELS.includes(s[i + 2]))) {
      return i + 2;
    }
    if (s[i + 1] === 'y') {
      // ny* handled by onset table
    } else if (!VOWELS.includes(s[i + 1])) {
      return i + 1;
    }
  }

  if (VOWELS.includes(s[i])) {
    return extendLongVowel(s, i + 1, s[i]);
  }

  for (const onset of ONSETS) {
    if (!s.startsWith(onset, i)) continue;
    const vowel = onset[onset.length - 1];
    return extendLongVowel(s, i + onset.length, vowel);
  }

  return i + 1;
}

export function romajiMoraBoundaries(word) {
  const s = word.toLowerCase();
  const bounds = [0];
  let i = 0;

  while (i < s.length) {
    const next = consumeMora(s, i);
    if (next <= i) break;
    if (next < s.length) bounds.push(next);
    i = next;
  }

  return bounds;
}

export function looksLikeRomaji(word) {
  if (!/^[a-zA-Z'-]+$/.test(word) || word.length < 2) return false;
  if (ENGLISH_MARKERS.test(word) || ENGLISH_SUFFIX.test(word)) return false;

  const s = word.toLowerCase();
  let i = 0;
  while (i < s.length) {
    const next = consumeMora(s, i);
    if (next <= i) return false;
    i = next;
  }

  return true;
}
