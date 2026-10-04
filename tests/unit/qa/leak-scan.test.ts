import { describe, expect, it } from 'vitest';
import {
  buildNeedles,
  decodeSignedCookie,
  findIdInJson,
  findIdInText,
  findIdInUrl,
  findLibraryInChunk,
  findTagline,
  findTitle,
  scanCaptured,
} from '../../../scripts/qa/leak-scan';

const film = { id: 120, title: 'The Lord of the Rings: The Fellowship of the Ring', tagline: 'One ring to rule them all.' };
const needles = buildNeedles(film);

describe('leak scanner', () => {
  it('finds the title case-insensitively, through HTML entities and JSON escapes', () => {
    expect(findTitle('<p>the lord of the rings: the fellowship of the ring</p>', needles)).not.toBeNull();
    expect(findTitle('{"t":"The Lord of the Rings: The Fellowship of the Ring"}', needles)).not.toBeNull();
    expect(findTitle('Fellowship&#x20;of the Ring', needles)).not.toBeNull();
    expect(findTitle('The Lord of the Rings: The Two Towers', needles)).toBeNull();
  });

  it('matches short single-word titles case-sensitively with word boundaries', () => {
    const up = buildNeedles({ id: 14160, title: 'Up' });
    expect(findTitle('"title":"Up"', up)).not.toBeNull();
    expect(findTitle('scroll up and setup', up)).toBeNull();
  });

  it('finds the tagline after normalizing', () => {
    expect(findTagline('&ldquo;One ring to rule them  all.&rdquo;', needles)).not.toBeNull();
    expect(findTagline('one ring', needles)).toBeNull();
  });

  it('flags the id only in film-id contexts inside text bodies', () => {
    expect(findIdInText('{"filmId":120,"x":1}', 120)).not.toBeNull();
    expect(findIdInText('self.__next_f.push([1,"{\\"id\\":120}"])', 120)).not.toBeNull();
    expect(findIdInText('/api/x?filmId=120&y=2', 120)).not.toBeNull();
    expect(findIdInText('transition:120ms;width:120px;"take":120', 120)).toBeNull();
    expect(findIdInText('{"filmId":1205}', 120)).toBeNull();
  });

  it('walks JSON and ignores other id spaces', () => {
    expect(findIdInJson({ reveal: { filmId: 120 } }, 120)).toBe('reveal.filmId = 120');
    expect(findIdInJson({ supporting: [{ personId: 120 }], genres: [{ id: 120 }], director: { personIds: [120] } }, 120)).toBeNull();
    expect(findIdInJson({ url: '/p/120' }, 120)).not.toBeNull();
  });

  it('flags the id in URL paths and query values', () => {
    expect(findIdInUrl('http://x/api/og/result?film=120', 120)).toBe(true);
    expect(findIdInUrl('http://x/vault/120/', 120)).toBe(true);
    expect(findIdInUrl('http://x/_next/static/chunks/a120b.js', 120)).toBe(false);
  });

  it('scanCaptured combines URL and body checks and honours skips', () => {
    const body = JSON.stringify({ reveal: { filmId: 120, title: film.title, tagline: film.tagline } });
    const all = scanCaptured({ url: 'http://x/api/guess', contentType: 'application/json', body }, needles);
    expect(all.map((f) => f.kind).sort()).toEqual(['id', 'tagline', 'title']);
    const skip = scanCaptured({ url: 'http://x/api/hint', contentType: 'application/json', body: JSON.stringify({ hint: { payload: { text: film.tagline } } }) }, needles, { skipTagline: true });
    expect(skip).toEqual([]);
  });

  it('detects library data in a chunk but not field names alone', () => {
    const lib = { films: Array.from({ length: 20 }, (_, i) => ({ title: `Film number ${i}`, tagline: `A tagline that is long ${i}` })) };
    expect(findLibraryInChunk('i.isAnswerEligible ? a : b', lib)).toBeNull();
    expect(findLibraryInChunk('{"isAnswerEligible":true}', lib)).not.toBeNull();
    expect(findLibraryInChunk(lib.films.slice(0, 3).map((f) => f.tagline).join(';'), lib)).not.toBeNull();
  });

  it('decodes the payload of a signed cookie', () => {
    const payload = JSON.stringify([{ guesses: [11, 12] }]);
    const b64 = Buffer.from(payload).toString('base64url');
    expect(decodeSignedCookie(encodeURIComponent(`${b64}.abc`))).toBe(payload);
  });
});
