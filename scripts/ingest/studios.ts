// Studio normalization (design doc Section 4.5).
//
// A curated alias table folds raw TMDB production companies into a headline studio. Only the
// headline studio is displayed and compared (binary match). This module is the single source of
// the alias seed: the fixture builder, the TMDB library builder, admin tooling and the Supabase
// loader all reuse it.
//
// Policy decisions (open question 6, documented in scripts/ingest/README.md):
// - Sub-brands that players do not perceive as separate studios fold into the parent:
//   Columbia + TriStar + Sony Pictures -> "Sony"; Walt Disney Animation + Touchstone -> "Disney";
//   Fox Searchlight + Searchlight Pictures -> "Searchlight"; Summit -> "Lionsgate";
//   20th Century Fox + 20th Century Studios -> "20th Century".
// - Labels with their own strong identity stay separate headline studios: "New Line" (not folded
//   into Warner Bros.), "Pixar", "Marvel Studios", "Lucasfilm" (not folded into Disney),
//   "Focus Features", "Searchlight", "Sony Pictures Classics", "A24", "Neon", "Miramax".
// - Raw company ids are TMDB production company ids from memory. Ids marked "approx" should be
//   verified against TMDB during the first real ingest (the report lists unmapped top companies).

export interface StudioAliasSeed {
  rawCompanyId: number;
  /** TMDB company name, for humans reviewing the table. */
  companyName: string;
  /** Headline studio name. Must be one of HEADLINE_STUDIOS. */
  studio: string;
  approx?: boolean;
}

/**
 * Headline studios in a fixed order. Fixture and TMDB libraries assign studio ids 1..N in this
 * order so ids are stable across runs. Studios discovered during ingest that are not in this list
 * get ids after N, allocated deterministically.
 */
export const HEADLINE_STUDIOS = [
  'Warner Bros.',
  'Universal',
  'Paramount',
  'Disney',
  'Pixar',
  'Marvel Studios',
  'Lucasfilm',
  '20th Century',
  'Sony',
  'Sony Pictures Classics',
  'Lionsgate',
  'A24',
  'Searchlight',
  'Focus Features',
  'Neon',
  'New Line',
  'Miramax',
  'DreamWorks',
  'United Artists',
  'Netflix',
  'Studio Ghibli',
  'Working Title',
  'Orion',
  'Castle Rock',
  'MGM',
  'Legendary',
  'Blumhouse',
  'Amazon MGM',
  'Apple',
  'Illumination',
  'The Weinstein Company',
  'Newmarket',
] as const;

export type HeadlineStudio = (typeof HEADLINE_STUDIOS)[number];

export const STUDIO_ALIAS_SEED: readonly StudioAliasSeed[] = [
  { rawCompanyId: 174, companyName: 'Warner Bros. Pictures', studio: 'Warner Bros.' },
  { rawCompanyId: 6194, companyName: 'Warner Bros. Entertainment', studio: 'Warner Bros.', approx: true },
  { rawCompanyId: 2785, companyName: 'Warner Bros. Animation', studio: 'Warner Bros.', approx: true },
  { rawCompanyId: 128064, companyName: 'DC Films', studio: 'Warner Bros.', approx: true },
  { rawCompanyId: 9993, companyName: 'DC Entertainment', studio: 'Warner Bros.', approx: true },
  { rawCompanyId: 33, companyName: 'Universal Pictures', studio: 'Universal' },
  { rawCompanyId: 4, companyName: 'Paramount Pictures', studio: 'Paramount' },
  { rawCompanyId: 2, companyName: 'Walt Disney Pictures', studio: 'Disney' },
  { rawCompanyId: 6125, companyName: 'Walt Disney Animation Studios', studio: 'Disney' },
  { rawCompanyId: 9195, companyName: 'Touchstone Pictures', studio: 'Disney', approx: true },
  { rawCompanyId: 3, companyName: 'Pixar', studio: 'Pixar' },
  { rawCompanyId: 420, companyName: 'Marvel Studios', studio: 'Marvel Studios' },
  { rawCompanyId: 1, companyName: 'Lucasfilm Ltd.', studio: 'Lucasfilm' },
  { rawCompanyId: 25, companyName: '20th Century Fox', studio: '20th Century' },
  { rawCompanyId: 127928, companyName: '20th Century Studios', studio: '20th Century', approx: true },
  { rawCompanyId: 5, companyName: 'Columbia Pictures', studio: 'Sony' },
  { rawCompanyId: 34, companyName: 'Sony Pictures', studio: 'Sony' },
  { rawCompanyId: 559, companyName: 'TriStar Pictures', studio: 'Sony' },
  { rawCompanyId: 58, companyName: 'Sony Pictures Classics', studio: 'Sony Pictures Classics' },
  { rawCompanyId: 1632, companyName: 'Lionsgate', studio: 'Lionsgate' },
  { rawCompanyId: 491, companyName: 'Summit Entertainment', studio: 'Lionsgate' },
  { rawCompanyId: 41077, companyName: 'A24', studio: 'A24' },
  { rawCompanyId: 43, companyName: 'Fox Searchlight Pictures', studio: 'Searchlight' },
  { rawCompanyId: 127929, companyName: 'Searchlight Pictures', studio: 'Searchlight', approx: true },
  { rawCompanyId: 10146, companyName: 'Focus Features', studio: 'Focus Features' },
  { rawCompanyId: 90733, companyName: 'Neon', studio: 'Neon', approx: true },
  { rawCompanyId: 12, companyName: 'New Line Cinema', studio: 'New Line' },
  { rawCompanyId: 14, companyName: 'Miramax', studio: 'Miramax' },
  { rawCompanyId: 7, companyName: 'DreamWorks Pictures', studio: 'DreamWorks' },
  { rawCompanyId: 521, companyName: 'DreamWorks Animation', studio: 'DreamWorks', approx: true },
  { rawCompanyId: 60, companyName: 'United Artists', studio: 'United Artists' },
  { rawCompanyId: 178464, companyName: 'Netflix', studio: 'Netflix', approx: true },
  { rawCompanyId: 10342, companyName: 'Studio Ghibli', studio: 'Studio Ghibli' },
  { rawCompanyId: 10163, companyName: 'Working Title Films', studio: 'Working Title' },
  { rawCompanyId: 41, companyName: 'Orion Pictures', studio: 'Orion' },
  { rawCompanyId: 97, companyName: 'Castle Rock Entertainment', studio: 'Castle Rock' },
  { rawCompanyId: 8411, companyName: 'Metro-Goldwyn-Mayer', studio: 'MGM', approx: true },
  { rawCompanyId: 923, companyName: 'Legendary Pictures', studio: 'Legendary', approx: true },
  { rawCompanyId: 3172, companyName: 'Blumhouse Productions', studio: 'Blumhouse', approx: true },
  { rawCompanyId: 20580, companyName: 'Amazon Studios', studio: 'Amazon MGM', approx: true },
  { rawCompanyId: 194232, companyName: 'Apple Studios', studio: 'Apple', approx: true },
  { rawCompanyId: 6704, companyName: 'Illumination', studio: 'Illumination', approx: true },
  { rawCompanyId: 308, companyName: 'The Weinstein Company', studio: 'The Weinstein Company', approx: true },
];

/** Studio id for a headline studio name (1-based position in HEADLINE_STUDIOS). */
export function headlineStudioId(name: string): number | null {
  const i = (HEADLINE_STUDIOS as readonly string[]).indexOf(name);
  return i === -1 ? null : i + 1;
}

/** Map of raw TMDB company id -> headline studio name. */
export function aliasMap(seed: readonly StudioAliasSeed[] = STUDIO_ALIAS_SEED): Map<number, string> {
  return new Map(seed.map((a) => [a.rawCompanyId, a.studio]));
}

export interface ProductionCompany {
  id: number;
  name: string;
}

/**
 * Headline studio rule: the first production company (in TMDB order) that maps to a known
 * headline studio; otherwise the first production company's own name; null if there are none.
 */
export function pickHeadlineStudio(
  companies: readonly ProductionCompany[] | undefined,
  aliases: Map<number, string> = aliasMap(),
): { name: string; rawCompanyId: number | null; mapped: boolean } | null {
  const list = companies ?? [];
  for (const c of list) {
    const studio = aliases.get(c.id);
    if (studio) return { name: studio, rawCompanyId: c.id, mapped: true };
  }
  const first = list[0];
  if (!first || !first.name.trim()) return null;
  return { name: first.name.trim(), rawCompanyId: first.id, mapped: false };
}

/**
 * Deterministic studio registry: headline studios take ids 1..N, any other names get N+1... in
 * the order they are first registered (callers register in film id order for stability).
 */
export class StudioRegistry {
  private byName = new Map<string, number>();
  private next: number;

  constructor() {
    HEADLINE_STUDIOS.forEach((n, i) => this.byName.set(n, i + 1));
    this.next = HEADLINE_STUDIOS.length + 1;
  }

  idFor(name: string): number {
    let id = this.byName.get(name);
    if (id === undefined) {
      id = this.next++;
      this.byName.set(name, id);
    }
    return id;
  }

  /** All studios, ordered by id. */
  list(): { id: number; name: string; logoPath: null }[] {
    return [...this.byName.entries()]
      .map(([name, id]) => ({ id, name, logoPath: null }))
      .sort((a, b) => a.id - b.id);
  }
}

/** The alias seed as `StudioAlias` rows (rawCompanyId -> headline studio id). */
export function aliasRows(seed: readonly StudioAliasSeed[] = STUDIO_ALIAS_SEED): { rawCompanyId: number; studioId: number }[] {
  return seed.map((a) => {
    const studioId = headlineStudioId(a.studio);
    if (studioId === null) throw new Error(`Alias ${a.rawCompanyId} maps to unknown studio "${a.studio}"`);
    return { rawCompanyId: a.rawCompanyId, studioId };
  });
}
