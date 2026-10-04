import { describe, expect, it } from 'vitest';
import { cleanText, containsProfanity, moderateNote } from '@/server/moderation';
import { PITCH } from '@/config/game';

describe('moderateNote', () => {
  it('treats missing or blank notes as no note', () => {
    expect(moderateNote(undefined, PITCH.noteMaxLength)).toEqual({ ok: true, text: null });
    expect(moderateNote(null, PITCH.noteMaxLength)).toEqual({ ok: true, text: null });
    expect(moderateNote('   \n\t ', PITCH.noteMaxLength)).toEqual({ ok: true, text: null });
  });

  it('trims, collapses whitespace and strips control / zero-width characters', () => {
    const zw = String.fromCharCode(0x200b);
    const ctrl = String.fromCharCode(0x07);
    expect(moderateNote(`  Think   big${zw} boats${ctrl}  `, PITCH.noteMaxLength)).toEqual({ ok: true, text: 'Think big boats' });
    expect(cleanText('a\u0000b')).toBe('ab');
  });

  it(`enforces ${PITCH.noteMaxLength} characters after cleanup`, () => {
    expect(moderateNote('x'.repeat(PITCH.noteMaxLength), PITCH.noteMaxLength).ok).toBe(true);
    const r = moderateNote('x'.repeat(PITCH.noteMaxLength + 1), PITCH.noteMaxLength);
    expect(r).toMatchObject({ ok: false, reason: 'too_long' });
    // Whitespace that collapses away does not count.
    expect(moderateNote(`${'x'.repeat(PITCH.noteMaxLength - 1)}      `, PITCH.noteMaxLength).ok).toBe(true);
  });

  it('rejects profanity (not masked), including leetspeak, stretching and spacing', () => {
    for (const bad of ['what the fuck', 'Sh1t happens', 'FUUUCK', 'you a s s h o l e', 'f u c k this']) {
      expect(moderateNote(bad, PITCH.noteMaxLength), bad).toMatchObject({ ok: false, reason: 'profanity' });
    }
  });

  it('does not flag innocent words that contain a blocked word', () => {
    for (const ok of ['Scunthorpe classic', 'An assassin on a cocktail cruise', 'Moby Dick vibes', 'Hitchcock would approve', 'pass the shiitake']) {
      expect(containsProfanity(ok), ok).toBe(false);
    }
  });

  it('rejects links', () => {
    expect(moderateNote('see https://example.com', PITCH.noteMaxLength)).toMatchObject({ ok: false, reason: 'link' });
    expect(moderateNote('go to spoilers.com', PITCH.noteMaxLength)).toMatchObject({ ok: false, reason: 'link' });
  });
});
