# Data ingest (WS1)

You can't add package.json scripts, so run each step with `pnpm exec tsx`. Every step can be re-run safely and gives the same result each time.

## Offline fixture library (no keys needed)

```sh
# edit scripts/ingest/fixture-source/films.ts (or people.ts), then:
pnpm exec tsx scripts/ingest/build-fixtures.ts       # -> src/server/db/fixtures/library.json
pnpm exec tsx scripts/ingest/build-search-index.ts   # -> public/search-index.json
```

`tests/unit/ingest/library.test.ts` fails if `library.json` or `search-index.json` no longer match the source.

## Real TMDB ingest

Put `TMDB_READ_TOKEN` (v4 bearer, preferred) or `TMDB_API_KEY` in `.env.local`. The scripts load `.env.local` themselves.

```sh
pnpm exec tsx scripts/ingest/tmdb-fetch.ts           # ~4,000 films -> data/cache/movies/<id>.json
pnpm exec tsx scripts/ingest/build-library.ts        # -> data/library.tmdb.json + data/ingest-report.json
pnpm exec tsx scripts/ingest/build-search-index.ts   # uses data/library.tmdb.json when it exists
pnpm exec tsx scripts/ingest/load-supabase.ts        # upsert into Supabase (needs service role key)
```

Options:
- `tmdb-fetch.ts --target 4000 --refresh --refresh-ids --popular-pages 60 --top-rated-pages 60 --discover-pages 40 --min-votes 300`
  - Candidate films come from popular, top rated, and `/discover` for each decade from the 1960s on, sorted by `vote_count.desc`. The sources are merged round-robin.
  - Each movie is fetched once with `append_to_response=credits,release_dates,videos,keywords` and cached. A re-run only fetches movies that aren't cached yet. `--refresh` fetches everything again.
  - Rate limits: at most 8 requests in flight and 40 requests started per 10 s. On 429 or 5xx it retries with exponential backoff and honors `Retry-After`. Failed fetches go to `data/cache/fetch-failures.json`, and the next run retries them.
- `build-library.ts --min-popularity 12 --min-votes 1500`. These are the answer-eligibility thresholds. Defaults are `ELIGIBLE_MIN_POPULARITY` and `ELIGIBLE_MIN_VOTES` in `normalize.ts`. Tune them after the first run so about 1,500 of 4,000 films are eligible.
- `load-supabase.ts [library.json] [--dry-run]`

`data/cache/` is git-ignored. You can commit `data/library.tmdb.json` and `data/ingest-report.json` if you want.

## Report

`data/ingest-report.json` lists:
- films missing box office
- films missing certifications, by region
- skipped films (no year, director, or genres)
- counts of the reasons films were not eligible
- the most common **unmapped** headline studios, as candidates for new aliases

The console prints a summary.

## Normalization rules

- **Director unit**: every crew member with job `Director`, deduplicated, in credit order. Known units get a nickname: The Coens, The Russo Brothers, Daniels, Lord and Miller, The Wachowskis, plus The Safdie Brothers (an addition). Other pairs show as "A and B", and three or more as "A, B and C".
- **Cast**: the lead is cast `order` 0. Supporting is the next `RULES.maxSupportingCast` cast members.
- **Year**: the earliest theatrical release date (type 3). If there isn't one, `release_date`.
- **Certifications**: one per supported region. Theatrical (type 3) is preferred. Otherwise the first non-empty certification.
- **Box office**: TMDB `revenue`. A value of 0 becomes `null`.
- **Score**: `round(vote_average * 10)`, frozen at ingest.
- **Trailer**: an official YouTube `Trailer`, oldest first. Unofficial trailers are used only as a fallback.
- **Answer eligible**: the film has box office, a US cert, a director, a lead, at least one genre, a tagline, and a score, and it clears the popularity and vote thresholds.
- **Awards**: blurbs written in-house. They are kept in the fixture source, and `build-library.ts` carries them over for every film the TMDB library contains.

## Studios (`studios.ts`)

`STUDIO_ALIAS_SEED` maps raw TMDB company ids to headline studios. Admin and the Supabase loader reuse it. Headline studio ids are their 1-based position in `HEADLINE_STUDIOS`. The headline studio is the first production company that maps to a known studio. If none maps, it is the first company's own name.

Decision on open question 6:
- **Folded into a parent**:
  - Columbia, TriStar and Sony Pictures become Sony.
  - Walt Disney Animation and Touchstone become Disney.
  - Fox Searchlight becomes Searchlight.
  - Summit becomes Lionsgate.
  - 20th Century Fox and 20th Century Studios become 20th Century.
- **Kept separate**: New Line, Pixar, Marvel Studios, Lucasfilm, Focus Features, Sony Pictures Classics, A24, Neon, Miramax. In both the fixtures and the TMDB library, the headline is the studio the film is credited to (Pixar films show "Pixar", MCU films show "Marvel Studios").

The company ids come from memory. Entries marked `approx: true` should be checked against the first real ingest report.

The loader upserts studios by their unique `name`, because `studios.id` is serial in Postgres. It then remaps film and alias studio ids to the database ids.

## Fixture library notes

- About 100 real films, 80 of them answer eligible.
- Movie ids are real TMDB ids.
- People in `fixture-source/people.ts` use their real TMDB ids (from memory). Everyone else gets a stable synthetic id from a hash of their name (900,000,000 and up). Either way, one person always has one id.
- Poster, profile and trailer fields are `null`. The UI falls back gracefully.
- Fixture headline studios are hand-assigned, using the credited studio players recognize (for example Star Wars and Raiders are "Lucasfilm", Parasite is "Neon").
- 4 Netflix films have unknown box office and are not eligible. A few deep cuts and sequels are playable but not eligible.
