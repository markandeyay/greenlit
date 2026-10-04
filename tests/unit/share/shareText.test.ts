import { describe, expect, it } from 'vitest';
import { APP_NAME, COPY, SITE_URL, shareHost } from '@/config/brand';
import { RULES } from '@/config/rules';
import {
  buildShareBody,
  buildShareText,
  describeShare,
  sharePath,
  shareUrl,
} from '@/components/share/shareText';
import { feedbackToCells } from '@/components/share/shareGrid';
import { fb, SECRET_FILM_ID, SECRET_TITLE, specExample } from './fixtures';

const host = shareHost();
const max = RULES.maxGuesses;

describe('buildShareText (Section 7.1)', () => {
  it('matches the spec shape for a win in 4', () => {
    expect(buildShareText(specExample())).toBe(
      [
        `${APP_NAME} · Reel 212 · Take 4/${max}`,
        '🎬 ⬛⬛⬛🟩🟨⬛🟩⬛',
        '🎬 🟩⬛⬛🟩🟨🟩⬛⬛',
        '🎬 🟩🟩⬛🟩🟩🟩🟩⬛',
        '🟢 🟩🟩🟩🟩🟩🟩🟩🟩',
        `${host}/212`,
      ].join('\n'),
    );
  });

  it('uses the literal 7.1 header format for the default brand', () => {
    const header = buildShareText(specExample()).split('\n')[0];
    expect(header).toBe(`${APP_NAME} · Reel 212 · Take 4/10`);
  });

  it('a win in 1 is a single winning row', () => {
    const input = specExample({ feedback: [fb('gggggggg', { correct: true })] });
    expect(buildShareText(input)).toBe([`${APP_NAME} · Reel 212 · Take 1/${max}`, '🟢 🟩🟩🟩🟩🟩🟩🟩🟩', `${host}/212`].join('\n'));
  });

  it('a loss shows Take X, no winning row, and the turnaround line', () => {
    const feedback = Array.from({ length: max }, () => fb('bbbbbbbb'));
    feedback[9] = fb('gbbyybbb');
    const text = buildShareText(specExample({ feedback, status: 'lost' }));
    const lines = text.split('\n');
    expect(lines[0]).toBe(`${APP_NAME} · Reel 212 · Take X/${max}`);
    expect(lines).toHaveLength(1 + max + 2);
    expect(lines.slice(1, 1 + max).every((l) => l.startsWith('🎬 '))).toBe(true);
    expect(lines[max]).toBe('🎬 🟩⬛⬛🟨🟨⬛⬛⬛');
    expect(lines[max + 1]).toBe(`🔴 ${COPY.lossStamp}`);
    expect(lines[max + 1]).toBe('🔴 SENT TO TURNAROUND');
    expect(lines[max + 2]).toBe(`${host}/212`);
    expect(text).not.toContain('🟢');
  });

  it('a give up after 2 takes', () => {
    const text = buildShareText(specExample({ feedback: [fb('bbbbbbbb'), fb('gbbbbbbb')], status: 'lost' }));
    expect(text).toBe(
      [`${APP_NAME} · Reel 212 · Take X/${max}`, '🎬 ⬛⬛⬛⬛⬛⬛⬛⬛', '🎬 🟩⬛⬛⬛⬛⬛⬛⬛', '🔴 SENT TO TURNAROUND', `${host}/212`].join('\n'),
    );
  });

  it('appends the notes flag to the header when hints were used', () => {
    const lines = buildShareText(specExample({ hintsUsed: 1 })).split('\n');
    expect(lines[0]).toBe(`${APP_NAME} · Reel 212 · Take 4/${max} 📝`);
    expect(buildShareText(specExample({ hintsUsed: 2 })).split('\n')[0]).toBe(lines[0]);
    expect(lines.slice(1).join('\n')).not.toContain('📝');
  });

  it('renders na box office (and na rating) as a black square', () => {
    const cells = feedbackToCells(fb('ggggnggg'));
    expect(cells[4]).toBe('miss');
    const text = buildShareText(specExample({ feedback: [fb('ggggnngg', { correct: true })] }));
    expect(text.split('\n')[1]).toBe('🟢 🟩🟩🟩🟩⬛⬛🟩🟩');
  });

  it('renders empty lead, supporting and genres as black squares', () => {
    const text = buildShareText(specExample({ feedback: [fb('geegggge'), fb('gggggggg', { correct: true })] }));
    expect(text.split('\n')[1]).toBe('🎬 🟩⬛⬛🟩🟩🟩🟩⬛');
  });

  it('collapses supporting and genres to one square: green if any match', () => {
    const f = fb('bbgbbbbg');
    expect(f.supporting.map((p) => p.verdict)).toContain('miss');
    expect(feedbackToCells(f)).toEqual(['miss', 'miss', 'match', 'miss', 'miss', 'miss', 'miss', 'match']);
  });

  it('never uses yellow for binary attributes, and ignores Score', () => {
    const f = fb('gggggggg');
    f.score = { value: 1, verdict: 'close', direction: 'up' };
    expect(feedbackToCells(f)).toEqual(Array(8).fill('match'));
  });

  it('vault plays link to /vault/n with the same header', () => {
    const text = buildShareText(specExample({ kind: 'vault', ref: '37', reelNumber: 37 }));
    expect(text.split('\n')[0]).toBe(`${APP_NAME} · Reel 37 · Take 4/${max}`);
    expect(text.split('\n').at(-1)).toBe(`${host}/vault/37`);
  });

  it('pitches have no reel number and link to /p/slug', () => {
    const text = buildShareText(specExample({ kind: 'pitch', ref: 'k3x9q2ab', reelNumber: null }));
    expect(text.split('\n')[0]).toBe(`${APP_NAME} · Pitch · Take 4/${max}`);
    expect(text.split('\n').at(-1)).toBe(`${host}/p/k3x9q2ab`);
  });

  it('never contains the title, film id, poster or any name', () => {
    const input = specExample({ hintsUsed: 1 });
    for (const out of [buildShareText(input), buildShareBody(input), describeShare(input)]) {
      expect(out).not.toContain(SECRET_TITLE);
      expect(out).not.toContain(String(SECRET_FILM_ID));
      expect(out).not.toContain('poster');
      expect(out).not.toContain('Person');
      expect(out).not.toContain('Some Director');
      expect(out).not.toContain('Drama');
    }
  });

  it('contains no em dashes', () => {
    expect(buildShareText(specExample())).not.toContain('—');
    expect(describeShare(specExample({ status: 'lost' }))).not.toContain('—');
  });

  it('body is the text minus the link line', () => {
    const input = specExample();
    expect(buildShareText(input)).toBe(`${buildShareBody(input)}\n${host}/212`);
  });

  it('builds paths and absolute URLs', () => {
    expect(sharePath({ kind: 'daily', ref: '5', reelNumber: 5 })).toBe('/5');
    expect(shareUrl({ kind: 'daily', ref: '5', reelNumber: 5 })).toBe(`${SITE_URL.replace(/\/$/, '')}/5`);
    expect(sharePath({ kind: 'pitch', ref: 'a/b', reelNumber: null })).toBe('/p/a%2Fb');
  });

  it('describes the grid in words for screen readers', () => {
    const d = describeShare(specExample());
    expect(d).toContain(`Won in 4 of ${max} takes`);
    expect(d).toContain('Take 1: Director no match, Lead no match, Supporting no match, Year match, Box office close');
    expect(describeShare(specExample({ status: 'lost' }))).toContain('Sent to turnaround after 4');
  });
});
