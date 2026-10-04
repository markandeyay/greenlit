import type { Metadata } from 'next';
import library from '@/server/db/fixtures/library.json';
import { FilmArt } from '@/components/art/FilmArt';
import { PersonArt } from '@/components/art/PersonArt';
import { FILM_PALETTES, MOTIFS } from '@/components/art/palette';
import { Poster } from '@/components/game/Poster';

export const metadata: Metadata = {
  title: 'Poster art',
  robots: { index: false, follow: false },
};

type Lib = { films: { id: number; title: string; releaseYear: number }[]; people: { id: number; name: string }[] };
const lib = library as unknown as Lib;

/** Dev gallery: every fixture film's designed poster at 300, 120 and 40px tall, plus person tiles. */
export default function ArtGalleryPage() {
  const films = lib.films.map((f) => ({ id: f.id, title: f.title, year: f.releaseYear }));
  const people = lib.people.slice(0, 30);
  return (
    <main className="l-page gl-page pb-16">
      <h1 className="ty-display mt-8 text-[length:var(--t-d2)]">Poster art</h1>
      <p className="mt-2 text-ink-dim">
        {films.length} films, {FILM_PALETTES.length} palettes, {MOTIFS.length} motifs. Deterministic from the title.
      </p>

      <h2 className="ty-label mt-10">300px</h2>
      <ul className="mt-3 flex flex-wrap gap-4" role="list">
        {films.map((f) => (
          <li key={f.id} className="overflow-hidden rounded-[3px] shadow-[var(--shadow-md)]" style={{ width: 200, height: 300 }}>
            <FilmArt film={f} size={300} label={`Poster art for ${f.title}`} />
          </li>
        ))}
      </ul>

      <h2 className="ty-label mt-10">120px</h2>
      <ul className="mt-3 flex flex-wrap gap-3" role="list">
        {films.map((f) => (
          <li key={f.id} className="overflow-hidden rounded-[3px] shadow-[var(--shadow-sm)]" style={{ width: 80, height: 120 }}>
            <FilmArt film={f} size={120} />
          </li>
        ))}
      </ul>

      <h2 className="ty-label mt-10">40px</h2>
      <ul className="mt-3 flex flex-wrap gap-2" role="list">
        {films.map((f) => (
          <li key={f.id} className="overflow-hidden rounded-[2px] shadow-[var(--shadow-sm)]" style={{ width: 27, height: 40 }}>
            <FilmArt film={f} size={40} />
          </li>
        ))}
      </ul>

      <h2 className="ty-label mt-10">Poster component (xs, sm, md, lg), with a broken image path</h2>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        {(['xs', 'sm', 'md', 'lg'] as const).map((s) => (
          <Poster key={s} title="The Grand Budapest Hotel" year={2014} posterPath={s === 'lg' ? '/does-not-exist.jpg' : null} size={s} />
        ))}
      </div>

      <h2 className="ty-label mt-10">People, 3:4 at 96px and square at 44px</h2>
      <ul className="mt-3 flex flex-wrap gap-3" role="list">
        {people.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-[var(--radius)]" style={{ width: 72, height: 96 }}>
            <PersonArt person={p} label={p.name} />
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-2" role="list">
        {people.map((p) => (
          <li key={p.id} className="overflow-hidden rounded-[var(--radius)]" style={{ width: 44, height: 44 }}>
            <PersonArt person={p} shape="square" />
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-wrap gap-2" role="list">
        {people.slice(0, 10).map((p, i) => (
          <li
            key={p.id}
            className="gl-status overflow-hidden rounded-[var(--radius)] border border-rule"
            data-verdict={i % 2 ? 'match' : 'miss'}
            style={{ width: 60, height: 75 }}
          >
            <PersonArt person={p} tone="status" />
          </li>
        ))}
      </ul>
    </main>
  );
}
