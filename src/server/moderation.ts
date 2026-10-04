// Moderation for user-written text (pitch notes, Sections 5, 8, 9). Pure; no I/O.
//
// Policy (documented decision): notes that contain profanity or slurs are REJECTED, not masked.
// Masking ("f***") still reads as the word to a friend and invites workarounds; a clear rejection
// lets the creator rephrase. Links are rejected too (a note is a clue, not a spam vector).
//
// Words that also name films or film subjects ("Moby Dick", "porn" in a Boogie Nights clue) are
// deliberately not blocked.
//
// Matching works on whole words after folding case, accents, common leetspeak (0->o, 1->i, 3->e,
// 4->a, 5->s, 7->t, @->a, $->s) and repeated letters ("fuuuck"), so innocent words that merely
// contain a blocked word ("Scunthorpe", "class", "assassin") pass. Spaced-out letters
// ("f u c k") are joined and checked as one word.
//
// The note is stored and rendered as plain text: control and zero-width characters are removed,
// whitespace is collapsed, and React escapes it on render (no HTML is ever interpreted).

/** Whole-word blocklist (lowercase, folded). Kept short and obvious on purpose. */
const BLOCKED = new Set([
  'fuck', 'fucker', 'fuckers', 'fucking', 'fucked', 'fucks', 'motherfucker', 'motherfucking', 'fck', 'fuk', 'fuq',
  'shit', 'shits', 'shitty', 'bullshit', 'shite',
  'cunt', 'cunts',
  'bitch', 'bitches',
  'asshole', 'assholes', 'arsehole',
  'dickhead', 'dickheads',
  'cocksucker',
  'pussy', 'pussies',
  'twat', 'wanker', 'wankers',
  'slut', 'sluts', 'whore', 'whores',
  'nigger', 'niggers', 'nigga', 'niggas',
  'faggot', 'faggots', 'fag', 'fags',
  'retard', 'retards', 'retarded',
  'spic', 'spics', 'chink', 'chinks', 'kike', 'kikes', 'wetback', 'tranny', 'trannies',
]);

const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i' };


const CONTROL_RE = buildControlRe();
const URL_RE = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|io|ly|gg|co|xyz|me|tv)\b/i;

/** Plain-text cleanup: strip control / zero-width / bidi characters, collapse whitespace, trim. */
export function cleanText(raw: string): string {
  return raw.normalize('NFC').replace(CONTROL_RE, '').replace(/\s+/g, ' ').trim();
}

function fold(word: string): string {
  const base = word
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[013457@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]/g, '');
  return base;
}

/** Collapse runs of the same letter ("fuuuck" -> "fuck"). */
function squeeze(word: string): string {
  return word.replace(/(.)\1+/g, '$1');
}

function isBlocked(word: string): boolean {
  if (!word) return false;
  if (BLOCKED.has(word)) return true;
  const sq = squeeze(word);
  if (BLOCKED.has(sq)) return true;
  // Words whose blocked form has a real double letter ("asshole") survive squeezing poorly, so
  // also compare against squeezed forms of the list.
  for (const b of BLOCKED) if (squeeze(b) === sq) return true;
  return false;
}

/** True when the text contains a blocked word (whole-word, folded). */
export function containsProfanity(text: string): boolean {
  const tokens = text.split(/[\s.,;:!?"'()[\]{}<>/\\|_~`^*+=#%&-]+/).filter(Boolean);
  const folded = tokens.map(fold);
  if (folded.some(isBlocked)) return true;
  // Spaced-out letters: join runs of single-character tokens ("f u c k").
  let run = '';
  for (const f of [...folded, '']) {
    if (f.length === 1) {
      run += f;
      continue;
    }
    if (run.length >= 3 && isBlocked(run)) return true;
    run = '';
  }
  return false;
}

export function containsLink(text: string): boolean {
  return URL_RE.test(text);
}

export type ModerationResult =
  | { ok: true; text: string | null }
  | { ok: false; reason: 'too_long' | 'profanity' | 'link'; message: string };

/**
 * Validate an optional note. Empty / whitespace-only becomes null. Never masks: returns a
 * rejection with a friendly, specific message instead.
 */
export function moderateNote(raw: string | null | undefined, maxLength: number): ModerationResult {
  if (raw === null || raw === undefined) return { ok: true, text: null };
  const text = cleanText(raw);
  if (!text) return { ok: true, text: null };
  if ([...text].length > maxLength) {
    return { ok: false, reason: 'too_long', message: `Keep the note to ${maxLength} characters or fewer.` };
  }
  if (containsLink(text)) return { ok: false, reason: 'link', message: 'Notes cannot contain links.' };
  if (containsProfanity(text)) {
    return { ok: false, reason: 'profanity', message: 'Keep the note friendly. Please rephrase it without that language.' };
  }
  return { ok: true, text };
}

/** C0/C1 controls (except tab/newline), zero-width, bidi overrides, word joiners and the BOM. */
function buildControlRe(): RegExp {
  const ranges: Array<[number, number]> = [
    [0x00, 0x08], [0x0b, 0x1f], [0x7f, 0x9f], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x206f], [0xfeff, 0xfeff],
  ];
  const hex = (n: number) => String.fromCharCode(92) + 'u{' + n.toString(16) + '}';
  return new RegExp('[' + ranges.map(([a, b]) => `${hex(a)}-${hex(b)}`).join('') + ']', 'gu');
}
