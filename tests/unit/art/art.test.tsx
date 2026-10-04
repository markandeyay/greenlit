// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import library from '@/server/db/fixtures/library.json';
import { FilmArt, filmArtVariant } from '@/components/art/FilmArt';
import { PersonArt } from '@/components/art/PersonArt';
import {
  FILM_PALETTES,
  LAYOUTS,
  MOTIFS,
  PERSON_PALETTES,
  contrast,
  keyLight,
  pickFilmArt,
  pickPersonPalette,
} from '@/components/art/palette';
import { CAP, fitTitle, monogram, splitTitle, upper, widthEm } from '@/components/art/title';
import { tmdbSizeFor } from '@/components/art/tmdb';
import { Poster } from '@/components/game/Poster';
import { PersonCell } from '@/components/game/PersonCell';
import { Headshot } from '@/components/modes/casting-call/Headshot';
import { FilmPoster } from '@/components/pitch/FilmPoster';

const films = (library as unknown as { films: { id: number; title: string; releaseYear: number }[] }).films;

describe('palettes', () => {
  it('has a curated set of 10 to 14 film palettes', () => {
    expect(FILM_PALETTES.length).toBeGreaterThanOrEqual(10);
    expect(FILM_PALETTES.length).toBeLessThanOrEqual(14);
    expect(new Set(FILM_PALETTES.map((p) => p.name)).size).toBe(FILM_PALETTES.length);
  });

  it('keeps every title, year and monogram AA (>= 4.5:1) on its poster ground', () => {
    for (const p of FILM_PALETTES) expect(contrast(p.ink, p.ground), p.name).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps portrait initials AA on the ground, the silhouette and the key light', () => {
    for (const p of PERSON_PALETTES) {
      expect(contrast(p.ink, p.ground), p.name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.ink, p.tone), p.name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.ink, keyLight(p)), p.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('computes WCAG contrast correctly', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('deterministic picks', () => {
  it('returns the same palette, motif and layout for the same title, every time', () => {
    for (const f of films) expect(pickFilmArt(f.title)).toEqual(pickFilmArt(f.title));
  });

  it('ignores case and punctuation in the seed', () => {
    expect(pickFilmArt('The Dark Knight')).toEqual(pickFilmArt('the dark  knight!'));
    expect(pickPersonPalette('Greta Gerwig')).toEqual(pickPersonPalette('greta gerwig'));
  });

  it('spreads the fixture library across most palettes, motifs and every layout', () => {
    const picks = films.map((f) => pickFilmArt(f.title));
    expect(new Set(picks.map((p) => p.palette.name)).size).toBeGreaterThanOrEqual(FILM_PALETTES.length - 2);
    expect(new Set(picks.map((p) => p.motif)).size).toBeGreaterThanOrEqual(MOTIFS.length - 2);
    expect(new Set(picks.map((p) => p.layout)).size).toBe(LAYOUTS.length);
  });

  it('never depends on the year (Release Order hides it until the round ends)', () => {
    const a = render(<FilmArt film={{ title: 'Heat', year: 1995 }} size={300} />).container.querySelector('svg')!;
    const b = render(<FilmArt film={{ title: 'Heat' }} size={300} />).container.querySelector('svg')!;
    for (const attr of ['data-palette', 'data-motif', 'data-layout']) expect(a.getAttribute(attr)).toBe(b.getAttribute(attr));
    expect(b.querySelector('[data-role="year"]')).toBeNull();
  });

  it('renders identical markup for identical input', () => {
    const one = render(<FilmArt film={{ id: 1, title: 'Arrival', year: 2016 }} size={300} />).container.innerHTML;
    const two = render(<FilmArt film={{ id: 1, title: 'Arrival', year: 2016 }} size={300} />).container.innerHTML;
    expect(one).toBe(two);
  });
});

describe('title setting', () => {
  it('fits every fixture title inside the title box', () => {
    for (const f of films) {
      const { main } = splitTitle(f.title);
      for (const style of ['uniform', 'stack'] as const) {
        const fit = fitTitle(upper(main), { width: 172, height: 72, style, maxSize: 60 });
        expect(fit.height, f.title).toBeLessThanOrEqual(72 + 0.01);
        for (const l of fit.lines) expect(widthEm(l.text) * l.size, `${f.title} ${l.text}`).toBeLessThanOrEqual(172 + 0.01);
      }
    }
  });

  it('balances line breaks instead of filling greedily', () => {
    const fit = fitTitle('THE SHAWSHANK REDEMPTION', { width: 172, height: 120, maxSize: 200 });
    expect(fit.lines.map((l) => l.text)).toEqual(['THE', 'SHAWSHANK', 'REDEMPTION']);
    const two = fitTitle('BACK TO THE FUTURE', { width: 172, height: 72, maxSize: 60 });
    expect(two.lines.map((l) => l.text)).toEqual(['BACK TO', 'THE FUTURE']);
    expect(two.lines[0]!.y).toBeCloseTo(two.lines[0]!.size * CAP, 5);
  });

  it('splits subtitles and makes 1 to 3 letter monograms', () => {
    expect(splitTitle('Dune: Part Two')).toEqual({ main: 'Dune', sub: 'Part Two' });
    expect(splitTitle('Se7en')).toEqual({ main: 'Se7en', sub: null });
    expect(monogram('The Dark Knight')).toBe('DK');
    expect(monogram('Up')).toBe('UP');
    expect(monogram('Jaws')).toBe('J');
    expect(monogram('Everything Everywhere All at Once')).toBe('EEA');
    expect(monogram('Everything Everywhere All at Once', 2)).toBe('EE');
    for (const f of films) expect(monogram(f.title).length).toBeGreaterThanOrEqual(1);
    for (const f of films) expect(monogram(f.title).length).toBeLessThanOrEqual(3);
  });
});

describe('FilmArt', () => {
  it('renders the full one-sheet at poster size: kicker, uppercase title, year', () => {
    const { container } = render(<FilmArt film={{ id: 11, title: 'Star Wars', year: 1977 }} size={300} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-variant')).toBe('full');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelector('[data-role="kicker"]')!.textContent).toBe('A FILM');
    expect(svg.querySelector('[data-role="title"]')!.textContent!.replace(/\s/g, '')).toBe('STARWARS');
    expect(svg.querySelector('[data-role="year"]')!.textContent).toBe('1977');
  });

  it('switches to the compact motif + monogram card at thumbnail size', () => {
    expect(filmArtVariant(40)).toBe('compact');
    expect(filmArtVariant(72)).toBe('compact');
    expect(filmArtVariant(120)).toBe('full');
    const { container } = render(<FilmArt film={{ title: 'The Dark Knight', year: 2008 }} size={40} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('data-variant')).toBe('compact');
    expect(svg.querySelector('[data-role="monogram"]')!.textContent).toBe('DK');
    expect(svg.querySelector('[data-role="title"]')).toBeNull();
    expect(svg.querySelector('[data-role="year"]')).toBeNull();
  });

  it('drops the tiny type at medium size but keeps the title', () => {
    const { container } = render(<FilmArt film={{ title: 'Dune: Part Two', year: 2024 }} size={120} />);
    expect(container.querySelector('[data-role="title"]')).not.toBeNull();
    expect(container.querySelector('[data-role="kicker"]')).toBeNull();
    expect(container.querySelector('[data-role="subtitle"]')).toBeNull();
  });

  it('takes an accessible name when labelled', () => {
    const { getByRole } = render(<FilmArt film={{ title: 'Heat' }} label="Poster for Heat" />);
    expect(getByRole('img', { name: 'Poster for Heat' })).toBeInTheDocument();
  });

  it('paints title text in the palette ink', () => {
    const { container } = render(<FilmArt film={{ title: 'Moonlight', year: 2016 }} size={300} />);
    const pal = pickFilmArt('Moonlight').palette;
    expect(container.querySelector('[data-role="title"]')!.getAttribute('fill')).toBe(pal.ink);
    expect(container.querySelector('rect')!.getAttribute('fill')).toBe(pal.ground);
  });
});

describe('PersonArt', () => {
  it('renders initials on a deterministic ground in both shapes', () => {
    for (const shape of ['portrait', 'square'] as const) {
      const { container } = render(<PersonArt person={{ id: 1, name: 'Greta Gerwig' }} shape={shape} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('viewBox')).toBe(shape === 'square' ? '0 0 120 120' : '0 0 120 160');
      expect(svg.querySelector('[data-role="initials"]')!.textContent).toBe('GG');
      expect(svg.getAttribute('data-palette')).toBe(pickPersonPalette('Greta Gerwig').name);
    }
  });

  it('status tone is transparent and drawn in currentColor so the verdict fill shows', () => {
    const { container } = render(<PersonArt person={{ name: 'Greta Gerwig' }} tone="status" />);
    expect(container.querySelector('[data-role="initials"]')!.getAttribute('fill')).toBe('currentColor');
    expect(container.querySelector('polygon')).toBeNull();
  });
});

describe('real images and fallback', () => {
  it('chooses the TMDB size from the rendered width', () => {
    expect(tmdbSizeFor(32)).toBe('w92');
    expect(tmdbSizeFor(48)).toBe('w154');
    expect(tmdbSizeFor(92)).toBe('w185');
    expect(tmdbSizeFor(96)).toBe('w342');
    expect(tmdbSizeFor(200)).toBe('w500');
    expect(tmdbSizeFor(900)).toBe('w500');
  });

  it('shows only the designed art when there is no posterPath', () => {
    const { container } = render(<Poster title="Heat" year={1995} posterPath={null} size="lg" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg[data-art="film"]')).not.toBeNull();
  });

  it('layers the real TMDB image over the art, lazy, sized, with alt', () => {
    const { container } = render(<Poster title="Heat" year={1995} posterPath="/heat.jpg" size="lg" alt="Poster for Heat" />);
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toBe('https://image.tmdb.org/t/p/w500/heat.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('width')).toBe('200');
    expect(img.getAttribute('height')).toBe('300');
    expect(img.getAttribute('alt')).toBe('Poster for Heat');
    expect(container.querySelector('[role="img"]')!.getAttribute('aria-label')).toBe('Poster for Heat');
    expect(container.querySelector('svg[data-art="film"]')).not.toBeNull();
    const xs = render(<Poster title="Heat" posterPath="/heat.jpg" size="xs" />).container.querySelector('img')!;
    expect(xs.getAttribute('src')).toContain('/w92/');
    expect(xs.getAttribute('alt')).toBe('');
  });

  it('swaps to the art when the image errors (never a broken image)', () => {
    const { container } = render(<Poster title="Heat" posterPath="/missing.jpg" size="md" />);
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg[data-art="film"]')).not.toBeNull();
  });

  it('falls back on error for pitch posters, casting headshots and people cells', () => {
    const pitch = render(<FilmPoster title="Heat" posterPath="/x.jpg" size="md" />).container;
    fireEvent.error(pitch.querySelector('img')!);
    expect(pitch.querySelector('img')).toBeNull();
    expect(pitch.querySelector('svg[data-art="film"]')).not.toBeNull();

    const head = render(<Headshot name="Al Pacino" profilePath="/p.jpg" />).container;
    expect(head.querySelector('img')!.getAttribute('loading')).toBe('lazy');
    fireEvent.error(head.querySelector('img')!);
    expect(head.querySelector('img')).toBeNull();
    expect(head.querySelector('[data-role="initials"]')!.textContent).toBe('AP');

    const cell = render(
      <PersonCell role="lead" person={{ name: 'Al Pacino', profilePath: '/p.jpg', verdict: 'miss' }} />,
    ).container;
    fireEvent.error(cell.querySelector('img')!);
    expect(cell.querySelector('img')).toBeNull();
    expect(cell.querySelector('svg[data-art="person"]')).not.toBeNull();
  });

  it('keeps the people cell label and verdict untouched', () => {
    const { container } = render(
      <PersonCell role="lead" person={{ name: 'Al Pacino', profilePath: null, verdict: 'match', answerRole: 'lead' }} />,
    );
    const cell = container.querySelector('.gm-person')!;
    expect(cell.getAttribute('role')).toBe('img');
    expect(cell.getAttribute('data-verdict')).toBe('match');
    expect(cell.getAttribute('aria-label')).toContain('Al Pacino');
  });
});

describe('copy rules', () => {
  it('has no em dashes in the art sources or the gallery page', () => {
    const root = join(process.cwd(), 'src');
    const files = [
      ...readdirSync(join(root, 'components/art')).map((f) => join(root, 'components/art', f)),
      join(root, 'app/dev/art/page.tsx'),
      join(root, 'components/game/Poster.tsx'),
      join(root, 'components/pitch/FilmPoster.tsx'),
      join(root, 'components/modes/casting-call/Headshot.tsx'),
    ];
    for (const f of files) expect(readFileSync(f, 'utf8').includes('—'), f).toBe(false);
    const html = render(<FilmArt film={{ title: 'Glass Onion: A Knives Out Mystery', year: 2022 }} size={300} />).container.innerHTML;
    expect(html.includes('—')).toBe(false);
  });
});
