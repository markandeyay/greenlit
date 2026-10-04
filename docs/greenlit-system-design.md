# Greenlit: System Design Document

> Working name: **Greenlit**. Daily movie deduction game.
> Status: v1 design, ready for implementation by parallel agents.
> Owner: Markandeya Yalamanchi
> Name collision note: a mobile app called "Greenlit - Movie Producer Game" exists (producer sim, different genre). The product name lives in one constant (`APP_NAME` in `src/config/brand.ts`) so a rename is trivial. Check domain and X handle availability before launch.

---

## 0. How to use this document (for Claude Code)

This doc is written to be split across subagents. Every workstream in **Section 12** has:
- a clear owner scope (folders it may touch),
- its inputs (contracts from other workstreams),
- its outputs,
- acceptance criteria.

**Rules for all agents:**
1. The contracts in **Section 8 (Data model)** and **Section 9 (API)** are the source of truth. Do not change a contract without updating this file first.
2. Shared types live in `src/lib/types.ts`. Only the Foundations workstream creates it; others import from it.
3. Never write the answer of any puzzle into client-reachable code, responses, or URLs before the player finishes that puzzle (see Section 10).
4. Never use em dashes in any user-facing copy.
5. Every UI change must work at 375px width and pass the accessibility rules in Section 6.7.

---

## 1. Product summary

Greenlit is a daily movie guessing game. Everyone gets the same mystery film each day. You get **10 guesses**. Each guess reveals how your film compares to the mystery film across a fixed set of attributes. The game builds a running **Call Sheet** of everything you have learned, so the fun is deduction, not memory.

The visual identity is a film production set: slates, timecode, reel numbers, call sheets, scene headings ("INT. THE SLATE - NIGHT"). It borrows its design language from the UNC Student Film Association site (`https://sfawebsite-kappa.vercel.app/`).

### 1.1 What we are beating (Spotle Movies, spotle.movie)

| Spotle problem | Greenlit fix |
|---|---|
| Three different "correct" signals (filled tile, chip, thin ring on a headshot). Players miss that the director is correct. | One signal everywhere: the whole cell fills green. People cells are full tiles, not rings. |
| Arrows are ambiguous ("2006 ↑" reads like "your number is high"). Arrows appear even on gray tiles. | Words, not arrows: LATER / EARLIER, BIGGER / SMALLER, HIGHER / LOWER. Plus a range bar in the Call Sheet. |
| Yellow for director ("shared a co-director elsewhere"), cast ("wrong role type"), studio ("sister label"). Trivia nobody can reason with. | People and studio are **binary**: match or no match. Yellow exists only for numeric closeness. |
| Box office "close" is a flat $100M, meaningless across scales. | Ratio-based closeness (Section 4.3). |
| TMDB score drifts over time. | Score is snapshotted at ingest and frozen per puzzle. |
| No summary. You re-scan every card. | Call Sheet panel aggregates all known constraints. |
| Genres only show matches. | Shows answer genre count and ruled-out genres. |
| Whole puzzle schedule (including future answers) is served as public JSON. Custom challenge links are Base64 of the title. | Server-side evaluation. Answers never leave the server until the puzzle ends. Custom challenges use opaque random slugs. |
| Generic dark dashboard plus three ad slots. | Film-set art direction. No ads at launch. |
| Local stats only bucket guesses 1 to 6 though the game allows 10. | Full 1 to 10 distribution plus a "shelved" (loss) bucket. |

---

## 2. Design principles

1. **One color means one thing.** Green = confirmed match. Yellow = numerically close. Gray = no match. Nothing else.
2. **Never make players remember.** The Call Sheet remembers for them.
3. **Words over symbols** for direction.
4. **Spoiler-free sharing** that still shows struggle.
5. **The answer is a secret.** Server holds it until the round ends.
6. **Theme in every pixel.** A win is "GREENLIT." A loss is "SENT TO TURNAROUND." The guess counter is "TAKE 4 / 10."
7. **Fast.** First contentful paint under 1s on 4G. Guess feedback under 150ms server time.

---

## 3. Information architecture

```
/                      Today's puzzle (the main game)
/how-to-play           Rules, color guide, attribute guide
/vault                 Archive of past daily puzzles ("The Vault")
/vault/[number]        Play a specific past puzzle
/pitch                 Create a custom challenge for a friend
/p/[slug]              Play a custom challenge
/leaderboard           Weekly / All time / Streaks
/stats                 Personal stats (local, synced if signed in)
/settings              Region (ratings), colorblind mode, reduced motion, sign in
/modes                 Hub for extra game modes (Section 5)
/modes/[mode]          Each extra mode
/admin                 Puzzle scheduling + film library tools (auth gated)
/api/*                 See Section 9
```

Navigation (top bar, styled like the SFA nav): `Today` `Vault` `Modes` `Leaderboard` and a slate-shaped `Pitch a film` button. Timecode readout in the corner showing time until the next puzzle (`TC 13:42:07:00`).

---

## 4. Core game: Classic (daily)

### 4.1 Round flow

1. Player types into the search box. Fuzzy autocomplete over the film library (title, original title, year, poster thumbnail). Selecting a title submits the guess.
2. Server evaluates the guess against today's answer and returns per-attribute feedback (never the answer).
3. A guess row animates in: a slate "clap" then cells flip left to right, 80ms stagger.
4. The Call Sheet updates.
5. Win: "GREENLIT" stamp animation, reveal card, share sheet.
6. Loss after take 10, or "Walk away" (give up, confirm dialog): "SENT TO TURNAROUND" card, reveal, share sheet.
7. Reveal card shows poster, title, year, director, tagline, and an embedded trailer (YouTube key from TMDB videos).

### 4.2 Attributes (fixed set, 12 cells per guess)

| # | Cell | Content | Green | Yellow | Gray | Direction word |
|---|---|---|---|---|---|---|
| 1 | Director | Exactly 1 directing credit (see 4.4) | Same directing credit, or any shared director within a co-directing unit | never | no shared director | none |
| 2 | Lead | Exactly 1 actor | This actor is in the answer's billed cast (any slot) | never | not in cast | none |
| 3 to 6 | Supporting | Max 4 actors, one cell each | Actor is in the answer's billed cast (any slot) | never | not in cast | none |
| 7 | Year | Theatrical release year | exact | within 3 years | more than 3 off | LATER / EARLIER |
| 8 | Box office | Worldwide gross, nominal USD | within 10% | within 2x either way | further | BIGGER / SMALLER |
| 9 | Rating | Certification for player region | same | never | different | none |
| 10 | Studio | Normalized headline studio | same normalized studio | never | different | none |
| 11 | Score | Frozen TMDB vote average x10 | exact | within 5 points | further | HIGHER / LOWER |
| 12 | Genres | 1 to 5 TMDB genres, shown as chips | each matching chip green | never | non-matching chips gray | none |

Notes:
- Cast cells are grouped visually: `DIRECTOR | LEAD | SUPPORTING x4`. Caps: director 1, lead 1, supporting max 4. Films with fewer than 4 supporting cast show empty slots as dashed outlines.
- **Cast matching is presence-based.** If your guess's lead appears anywhere in the answer's capped cast (lead or supporting), the cell is green. A small corner tag shows where they sit in the answer (`LEAD` or `SUPP`) only after the match, as information, not as a color. No yellow.
- Direction words appear on gray and yellow numeric cells. Green cells show no word.
- Box office: if either film has unknown box office (`null`), the cell shows `N/A` in a neutral style and is excluded from the Call Sheet. Curated daily answers must have box office data (enforced at scheduling).
- Score is frozen at ingest time into `films.score_snapshot`. Never refetch for a scheduled puzzle.

### 4.3 Closeness thresholds (constants in `src/config/rules.ts`)

```ts
export const RULES = {
  maxGuesses: 10,
  yearClose: 3,                 // years
  boxOfficeGreenPct: 0.10,      // within 10% is green
  boxOfficeCloseRatio: 2.0,     // within 2x is yellow
  scoreClose: 5,                // points on 0-100
  maxSupportingCast: 4,
  hintUnlockAfter: [5, 8],      // guesses
} as const;
```

Agents must import these, never hardcode.

### 4.4 Director normalization

- One "directing credit" per film. For co-directed films (Coen brothers, Russo brothers, Daniels, Lord and Miller), the credit is a **unit** stored as an ordered list of person IDs with a display name ("The Coens", "Daniels").
- Match rule: green if the two credits share at least one person ID.
- Display: single portrait for one director, split portrait for a unit.

### 4.5 Studio normalization

A curated mapping table `studio_aliases` folds sub-brands into a headline studio (Walt Disney Pictures -> Disney, Fox Searchlight -> Searchlight, New Line -> Warner Bros. is NOT folded unless we decide so). The mapping is data, editable in `/admin`. Only the headline studio is displayed and compared. Binary match only.

### 4.6 Rating region

Default from `Accept-Language` / geo header, overridable in `/settings`. Supported at launch: US (MPA), UK (BBFC), CA, AU, IN, DE. If the answer has no certification for the region, fall back to US and show a tiny `US` tag.

### 4.7 The Call Sheet (signature feature)

A persistent panel (right column on desktop, collapsible drawer pinned above the guess list on mobile) styled as a production call sheet. It is computed **client-side from feedback only** (never from the answer) and shows:

```
CALL SHEET  ·  Reel No. 212  ·  Take 4 / 10
---------------------------------------------
Director     Christopher Nolan        CONFIRMED
Cast         Michael Caine            CONFIRMED
             Hugh Jackman             CUT
Year         2007 to 2011             [====|====] range bar
Box office   $420M to $1.7B           [  ===== ] range bar (log scale)
Score        78 to 87
Rating       PG-13                    CONFIRMED
Studio       not Universal, not A24
Genres       Sci-Fi CONFIRMED · 3 genres total · ruled out: Comedy, Horror
```

Rules:
- Ranges are derived by intersecting all bounds implied by each guess's feedback (exact, close band, direction).
- "CONFIRMED" uses the green token. "CUT" (ruled out) uses strikethrough gray.
- The answer's genre count is part of feedback (`genreCount`) so the sheet can say "3 genres total."
- Tapping any Call Sheet row highlights the guess rows that produced it.

### 4.8 Hints ("Script Notes")

- Two hints. Note 1 unlocks after take 5, Note 2 after take 8. Using a hint is optional and is recorded (shown in the share as a small 📝).
- Each puzzle stores 3 candidate hints. When a note unlocks, the player picks one of the remaining candidates by its **type label** (e.g. "Tagline", "Plot keywords", "Famous co-star film") without seeing the content, then reveals it.
- Hint types: `tagline`, `plot_keywords` (3 to 5 keywords), `cast_connection` (another film sharing an actor), `filmography` (other films by the director), `awards` (e.g. "Won Best Original Screenplay"), `sequel_status`, `decade_vibe` (curated one-liner), `first_letter` (last resort, never in note 1).
- Hint content is fetched from `POST /api/hint` only after the unlock threshold is reached server-side.

### 4.9 Scoring

- Score per puzzle = number of takes used (1 to 10). Loss = 11 for leaderboard averaging.
- Hints do not change the take count but are flagged. Leaderboards have a "no notes" filter.

### 4.10 Daily reset

- Global reset at **00:00 America/New_York**. One puzzle for the whole world so leaderboards and shares line up.
- Puzzle number = days since launch day + 1 ("Reel No. 001").

---

## 5. Extra modes (the "Modes" hub)

Ship Classic first. Modes are phased (Section 13). Each mode reuses the film library, search component, and share system.

| Mode | Phase | Pitch | Mechanic |
|---|---|---|---|
| **Classic** | 1 | Deduce the film | Section 4 |
| **The Vault** | 1 | Play past dailies | Any past puzzle, no leaderboard credit, stats tracked separately |
| **Pitch** (custom challenge) | 1 | Pick a film, challenge a friend | Creator picks film + optional note (unlocks at take 5). Server returns opaque slug `/p/k3x9q2`. Answer stored server-side. Creator sees how friends did. |
| **Unlimited / Dailies Reel** | 2 | Endless practice | Random film from a difficulty band (Popular / Cinephile / Deep cut). No streaks. |
| **Opening Weekend** | 2 | Higher or lower | Two posters, pick which grossed more. Streak-based. 60s daily run for leaderboard. |
| **Release Order** | 2 | Sort 5 films by release date | One daily set. 3 attempts, feedback per position (Wordle-style). |
| **Casting Call** | 3 | Connect two actors | Daily start and end actor. Chain through shared films in as few links as possible. Validated against cast graph. |
| **Frame Lock** | 3 | Guess from stills | 6 progressively less cropped frames. Needs a licensed still source; postponed until rights are clear. Do not scrape. |
| **Logline** | 3 | Guess from a one-line synopsis | Logline gets less vague each take. Loglines are written in-house (not copied from any source). |
| **Double Feature** | 3 | Live 1v1 | Two players, same film, race. Realtime channel. |
| **Themed weeks** | 2 | Curated runs | "Nolan Week", "A24 Week", "Best Picture Winners". Scheduling feature, not a new engine. |

---

## 6. Design system (derived from the SFA site)

Pull the actual tokens (fonts, hex values, spacing) from the SFA website source if it is available locally. If not, use the proposed tokens below and match the SFA site by eye. The SFA site is Next.js on Vercel; reuse its patterns where possible.

### 6.1 Motifs to carry over

- **Film leader**: countdown numbers (8, 7, 6...) on load, "Picture start" frame, head and tail leader at page top and bottom.
- **Timecode**: `TC 00:00:00:00` readouts, `24 fps`, `2.39 : 1` aspect labels as decorative microcopy.
- **Slate metadata**: `Roll 2026 · Reel 212 · Sc 01 · Tk 04` lines above major sections.
- **Scene headings**: section titles like `INT. THE CALL SHEET - NIGHT`, numbered `01`, `02`.
- **Italic serif accent words** inside bold sans headings (e.g. "The *Vault*", "Awards *Night*").
- **Breadcrumb chevrons**: `GREENLIT ▸ 2026 ▸ 212A`.
- **Call sheet tables** for structured info.
- **End credits** footer: "The End · A Greenlit production".

### 6.2 Color tokens (proposed; replace with SFA values if available)

```css
:root {
  --bg: #0c0b0a;            /* projection-booth black */
  --surface: #161412;
  --surface-2: #1f1c19;
  --ink: #f2ede4;           /* film-print cream */
  --ink-dim: #a39b8e;
  --rule: #34302b;
  --green: #2fbf71;         /* the greenlight; MATCH */
  --green-ink: #06210f;
  --amber: #e8a93a;         /* CLOSE (numeric only) */
  --amber-ink: #2a1a00;
  --miss: #3a3633;          /* NO MATCH */
  --red-rec: #e5484d;       /* REC dot, loss state accents only */
}
[data-theme="light"] { /* optional "daylight print" theme, phase 2 */ }
```

Status colors must never be reused decoratively.

### 6.3 Typography

- Display: condensed bold sans, uppercase, tight tracking (SFA-style headings).
- Accent: italic serif for single emphasized words.
- Mono: for timecode, slate metadata, numbers in cells (tabular numerals).
- Body: clean grotesk.
Load via `next/font`. Max 3 families.

### 6.4 Key components

| Component | Notes |
|---|---|
| `Slate` | Clapperboard header with take number. Animates "clap" on each guess. |
| `GuessRow` | Poster thumb + title + 12 cells grouped: People / Numbers / Labels / Genres. |
| `PersonCell` | Full-bleed headshot in a tile; whole tile tints green on match. Name below. Role tag on match. |
| `NumberCell` | Big tabular number, label, direction word. |
| `LabelCell` | Rating, studio (logo if available, text fallback). |
| `GenreChips` | Chips, green or gray. |
| `CallSheet` | Section 4.7. |
| `RangeBar` | Horizontal bar, known range highlighted, last guess ticks. Log scale option. |
| `SearchBox` | Fuzzy, keyboard-first, poster thumbs, already-guessed titles disabled. |
| `ResultCard` | GREENLIT stamp / SENT TO TURNAROUND; reveal; trailer; share. |
| `ShareSheet` | Copy text, share to X, download image. |
| `Leader` | Countdown intro animation (skippable, respects reduced motion). |
| `TimecodeClock` | Countdown to next puzzle. |

### 6.5 Layout

- Desktop (>= 1024px): two columns. Left: slate, search, guess list (newest on top). Right: sticky Call Sheet.
- Mobile: single column. Call Sheet as a sticky collapsible strip under the search ("Call Sheet · 4 confirmed"), expands to full sheet.
- Guess row on mobile: poster + title line, then people strip (6 tiles, horizontally scrollable if needed), then a 2x3 grid of number/label cells, then genre chips.

### 6.6 Motion

- Leader countdown on first visit of the day (1.2s, skippable).
- Cell flip on reveal, 80ms stagger.
- GREENLIT rubber-stamp on win; subtle film grain overlay; projector flicker on loss card.
- All motion disabled under `prefers-reduced-motion`.

### 6.7 Accessibility

- Color is never the only signal: matched cells get a ✓ glyph, close cells a `≈` glyph, misses none.
- Colorblind mode swaps green/amber for blue/orange and adds patterns.
- Every cell has an `aria-label` like "Year 2006, close, answer is later."
- Full keyboard play. Focus rings visible.
- Contrast AA minimum.

---

## 7. Sharing (virality engine)

### 7.1 Share text

```
Greenlit · Reel 212 · Take 4/10
🎬 ⬛⬛⬛🟩🟨⬛🟩⬛
🎬 🟩⬛⬛🟩🟩🟨🟩⬛
🎬 🟩🟩⬛🟩🟩🟩🟩🟨
🟢 🟩🟩🟩🟩🟩🟩🟩🟩
greenlit.(tld)/212
```

- 8 squares per row = Director, Lead, Supporting (any match), Year, Box office, Rating, Studio, Genres (any match). Supporting and genres collapse to one square to keep rows short.
- Loss: final line `🔴 SENT TO TURNAROUND`. Hints used: append ` 📝` to the header.
- Text only; no title, no spoilers.

### 7.2 Share image

- `GET /api/og/result?...` renders a 1200x630 image (Next.js `ImageResponse`) of the grid styled as a slate. Used for "Download image" and as the OG image for share links.
- Daily OG image for `/` shows "Reel 212" and a blurred, unrecognizable film-grain texture. Never the poster.

### 7.3 Post-game stats line

Result card shows "You beat 68% of players today" and the global take distribution (from aggregated server stats, updated every minute).

---

## 8. Data model

Postgres (Supabase). All tables have `created_at`, `updated_at`.

```sql
-- Film library
films (
  id               int primary key,          -- TMDB movie id
  title            text not null,
  original_title   text,
  release_year     int not null,
  release_date     date,
  poster_path      text,
  backdrop_path    text,
  runtime_min      int,
  box_office_usd   bigint,                   -- nullable
  score_snapshot   int,                      -- 0..100, frozen
  studio_id        int references studios(id),
  director_unit    jsonb not null,           -- {"ids":[525], "display":"Christopher Nolan"}
  lead_person_id   int references people(id),
  supporting_ids   int[] not null,           -- length 0..4
  genre_ids        int[] not null,           -- 1..5
  trailer_youtube  text,
  tagline          text,
  popularity       real,                     -- for difficulty bands
  is_playable      boolean default true,     -- appears in search
  is_answer_eligible boolean default false   -- curated for dailies
)

film_certifications ( film_id int, region text, rating text, primary key (film_id, region) )
people   ( id int primary key, name text, profile_path text )
studios  ( id serial primary key, name text, logo_path text )
studio_aliases ( raw_company_id int primary key, studio_id int references studios(id) )
genres   ( id int primary key, name text )

-- Scheduling
puzzles (
  number       int primary key,              -- Reel number
  date         date unique not null,         -- in America/New_York
  film_id      int references films(id) not null,
  theme        text,                         -- nullable, e.g. "Nolan Week"
  hints        jsonb not null                -- 3 candidates [{type, payload}]
)

-- Custom challenges
pitches (
  slug         text primary key,             -- 8 char random, base36
  film_id      int not null,
  note         text,                         -- max 140 chars, moderated
  creator_id   uuid null,
  created_at   timestamptz
)

-- Players
profiles ( id uuid primary key, handle text unique, region text, created_at timestamptz )

-- Play records (server truth for leaderboards)
plays (
  id           uuid primary key,
  profile_id   uuid null,                    -- null for anonymous
  anon_id      uuid not null,                -- device id cookie
  kind         text not null,                -- 'daily' | 'vault' | 'pitch' | mode name
  ref          text not null,                -- puzzle number or pitch slug
  guesses      int[] not null,               -- film ids in order
  hints_used   text[] not null,
  status       text not null,                -- 'in_progress' | 'won' | 'lost'
  takes        int,
  started_at   timestamptz,
  finished_at  timestamptz,
  unique (anon_id, kind, ref)
)

-- Aggregates
daily_stats ( puzzle_number int primary key, distribution int[11], plays int, wins int )
```

Row Level Security: `puzzles.film_id`, `puzzles.hints`, and `pitches.film_id` are **never** selectable by anon or authenticated roles. Only the service role (server routes) reads them.

---

## 9. API contracts

All routes are Next.js Route Handlers under `src/app/api`. JSON in, JSON out. Types in `src/lib/types.ts`.

```ts
// Shared
type Verdict = 'match' | 'close' | 'miss' | 'na';
type Direction = 'up' | 'down' | null;   // up = answer is later/bigger/higher

interface PersonFeedback { personId: number; name: string; profilePath: string | null;
                           verdict: 'match' | 'miss'; answerRole?: 'lead' | 'supp' | 'director'; }
interface NumberFeedback { value: number | null; verdict: Verdict; direction: Direction; }

interface GuessFeedback {
  filmId: number; title: string; posterPath: string | null;   // guessed film's year is year.value (9.1)
  director: { display: string; verdict: 'match' | 'miss'; personIds: number[] };
  lead: PersonFeedback | null;
  supporting: PersonFeedback[];            // 0..4
  year: NumberFeedback;
  boxOffice: NumberFeedback;
  score: NumberFeedback;
  rating: { value: string | null; verdict: 'match' | 'miss' | 'na'; region: RegionCode }; // region: 9.1
  studio: { name: string; logoPath: string | null; verdict: 'match' | 'miss' };
  genres: { id: number; name: string; verdict: 'match' | 'miss' }[];
  genreCount: number;                      // answer's genre count
  isCorrect: boolean;
}
```

| Method + path | Body / query | Returns | Notes |
|---|---|---|---|
| `GET /api/search?q=` | q (2+ chars) | `{ results: {id,title,year,posterPath}[] }` | Server-side fuzzy search. Optionally also ship a static compressed index (`/search-index.json`) of id/title/year/poster for instant client search. Contains every playable film, so it reveals nothing. |
| `GET /api/today` | none | `{ number, date, theme, nextResetAt }` | No answer. |
| `POST /api/guess` | `{ kind, ref, filmId }` | `{ feedback: GuessFeedback, take, status, reveal?: Reveal }` | Validates film exists, not already guessed, under 10 takes. Persists to `plays`. `reveal` included only when status becomes won/lost. Rate limit 30/min per anon_id. |
| `POST /api/giveup` | `{ kind, ref }` | `{ status: 'lost', reveal }` | |
| `POST /api/hint` | `{ kind, ref, slot: 1|2, hintType }` | `{ hint }` | Rejects if takes < unlock threshold. |
| `GET /api/hint/options` | `kind, ref` | `{ slot1: string[], slot2: string[] }` | Type labels only. |
| `GET /api/play` | `kind, ref` | current play state (guesses re-evaluated to feedback) | Lets a returning player resume on any device if signed in. |
| `POST /api/pitch` | `{ filmId, note? }` | `{ slug, url }` | Note is profanity-filtered and length-capped. |
| `GET /api/pitch/[slug]/results` | creator only | friends' results | |
| `GET /api/leaderboard` | `period=week|all|streak&noNotes=bool` | rows | Weekly requires 3 of last 7 dailies. Loss counts as 11. |
| `GET /api/stats/daily/[number]` | | distribution | Cached 60s. |
| `GET /api/og/result` | encoded grid | PNG | Grid only, no answer. |
| `POST /api/admin/*` | | | Scheduling, film edits, studio aliases. Admin role only. |

`Reveal` = `{ filmId, title, year, posterPath, director, tagline, trailerYoutube }`.

### 9.1 Contract additions and clarifications (WS0)

The full typed contract is `src/lib/types.ts`. These items extend or clarify the sections above:

1. **`GuessFeedback.year` collision.** The original block declared `year` twice (`number` and `NumberFeedback`). The scalar is removed; the guessed film's year is `year.value`.
2. **`GuessFeedback.rating.region`.** The region whose certifications were compared. Equals the player's region unless the answer has none there, then `'US'` (Section 4.6), and the UI shows a small region tag.
3. **Region resolution.** Server reads the `gl_region` cookie (set by `/settings`), then the profile region, then `Accept-Language`. Region codes are TMDB ISO codes: `US, GB, CA, AU, IN, DE` (`GB` is labeled "UK").
4. **Hint types and payloads** are a discriminated union `Hint` in `types.ts`. New type `creator_note`: a pitch's optional note, offered as the slot 1 option on pitches after `PITCH.noteUnlockAfter` (5) takes. `GET /api/hint/options` returns type ids (`HintType[]`); labels live in `src/config/hints.ts`. `plays.hints_used[0]` is slot 1's type, `[1]` is slot 2's.
5. **`GET /api/play`** returns `PlayStateResponse { kind, ref, status, take, feedback[], hints: UsedHint[], reveal? }`. With no play yet: `in_progress`, take 0, empty arrays.
6. **Errors** use `{ error: { code, message } }` with codes in `ApiErrorCode`.
7. **`kind` / `ref`.** `daily` is only today's puzzle; past puzzles are `vault`. `ref` is the puzzle number as a string, or the pitch slug.
8. **Data model additions:** `films.keywords text[]` (hint generation), `film_awards` table (curated awards blurbs), `profiles.flagged` and `profiles.flag_reason` (anti-cheat hold), `plays.first_guess_at` (time-to-first-guess flag). `daily_stats.distribution` index 0..9 = won in 1..10, index 10 = turnaround.
9. **RLS detail.** Column rules are enforced with column privileges. Client roles can read: the film library tables; `puzzles(number, date, theme)` for dates up to today only; their own `pitches(slug, note, creator_id, created_at)` when signed in; `profiles(id, handle, created_at)`; released `daily_stats`. `plays`, `film_awards`, and all answer columns are service role only. Verified by `pnpm db:verify`.
10. **Search index file:** `public/search-index.json` is `SearchIndexFile { v: 1, films: SearchIndexEntry[] }`.
11. **Client persistence:** `ClientSettings` (localStorage `gl_settings`), `LocalStatsFile` (`gl_stats`). Keys in `src/config/game.ts`.
12. **Policy constants** stated in prose (loss = 11, rate limits, 60 day scheduling window, 365 day cooldown, weekly 3 of 7, anti-cheat thresholds, pitch slug and note rules, launch date) live in `src/config/game.ts`. `RULES` in `rules.ts` stays exactly as 4.3.
13. **Numeric comparison math** lives in `src/lib/verdicts.ts` and is the single definition used by the evaluator and the Call Sheet. Box office: match when max/min <= 1.10, close when max/min <= 2.0, `na` if either side is unknown. Year and score: match on equality, close within the band. Direction `up` means the answer is larger.
14. **Data access** goes only through the `Repo` interface in `src/server/db/repo.ts` (`getRepo()`). Without Supabase env vars it is an in-memory repo seeded from `src/server/db/fixtures/library.json` (a `LibrarySnapshot`) with a deterministic schedule from launch day to today + 60.
15. **Session** lookup is `getCurrentUser()` in `src/server/auth.ts` (implemented by WS7).
16. **Calendar math** (New York day, reel number, next reset, DST safe) lives in `src/lib/dates.ts`. Title matching for search lives in `src/lib/search.ts`.

---

## 10. Security and anti-cheat

The bar: a curious player with DevTools cannot learn today's answer.

1. Answers live only in `puzzles` / `pitches`, readable only by the service role.
2. Feedback is computed server-side in `src/server/evaluate.ts`. Client never receives answer attributes, only verdicts relative to the guessed film.
3. Feedback leaks are bounded by design (e.g. "answer has 3 genres" is intended info).
4. No future puzzle data is ever served. `/api/today` and the Vault expose only dates up to today.
5. Pitch slugs are random (not derived from the film). Pitch answers revealed only to the creator or after the solver finishes.
6. Leaderboard only counts server-recorded `plays` with `profile_id`. Suspicious patterns flagged: daily wins in 1 take more than twice in 7 days, median time-to-first-guess under 3s. Flagged players are hidden from boards pending review, not banned automatically.
7. Rate limits per anon_id and IP (Upstash Redis or Vercel KV).
8. Anonymous players: `anon_id` in an httpOnly cookie. On sign-in, merge anon plays into the profile.

---

## 11. Tech stack and repo layout

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Matches SFA site; SSR + route handlers + OG images |
| Styling | Tailwind CSS + CSS variables (tokens in 6.2) | Fast, tokenized |
| DB + Auth | Supabase (Postgres, RLS, Auth with Google/X/email magic link) | RLS protects answers; free tier fine |
| Cache / rate limit | Upstash Redis | |
| Hosting | Vercel | Cron for daily jobs |
| Data source | TMDB API (attribution required in footer and How to Play) | Posters, credits, release dates, certifications, revenue, videos |
| Search | MiniSearch (client index) + Postgres `pg_trgm` fallback | |
| Testing | Vitest (logic), Playwright (e2e) | |
| Analytics | Plausible or PostHog (privacy-friendly, no ad trackers) | |

```
greenlit/
  src/
    app/
      page.tsx                     # Today
      how-to-play/page.tsx
      vault/page.tsx
      vault/[number]/page.tsx
      pitch/page.tsx
      p/[slug]/page.tsx
      leaderboard/page.tsx
      stats/page.tsx
      settings/page.tsx
      modes/...
      admin/...
      api/... (Section 9)
    components/
      game/ (Slate, GuessRow, PersonCell, NumberCell, LabelCell, GenreChips, SearchBox, ResultCard)
      callsheet/ (CallSheet, RangeBar)
      share/ (ShareSheet, shareText.ts)
      chrome/ (Nav, Leader, TimecodeClock, Footer)
    config/ (brand.ts, rules.ts, regions.ts)
    lib/ (types.ts, callsheet.ts, format.ts, anon.ts)
    server/ (evaluate.ts, puzzles.ts, plays.ts, hints.ts, leaderboard.ts, ratelimit.ts, supabase.ts)
    styles/ (tokens.css, globals.css)
  scripts/
    ingest/ (tmdb-fetch.ts, normalize.ts, studios.ts, build-search-index.ts)
    schedule/ (seed-puzzles.ts, generate-hints.ts)
  supabase/migrations/
  tests/ (unit/, e2e/)
  docs/ (this file)
```

---

## 12. Workstreams for parallel agents

Dependencies: **WS0 first**, then WS1 to WS4 in parallel, then WS5 to WS8.

### WS0: Foundations (blocking)
- **Scope:** repo scaffold, `src/lib/types.ts`, `src/config/*`, `src/styles/tokens.css`, Supabase migrations from Section 8, env template.
- **Accept:** `pnpm dev` runs; migrations apply; types compile; tokens importable.

### WS1: Data ingest
- **Scope:** `scripts/ingest/*`, `studio_aliases` seed.
- **Do:** Pull ~4,000 films from TMDB (popular + top rated + curated lists across decades). For each: credits (director unit, lead = billing order 0, supporting = billing 1 to 4), genres, certifications for supported regions, revenue, vote average snapshot, videos (official YouTube trailer), tagline, keywords (for hints). Normalize studios. Mark `is_answer_eligible` for films with complete data and popularity above threshold. Build `public/search-index.json`.
- **Accept:** Re-runnable and idempotent. Report of films missing box office or certification. Respects TMDB rate limits.

### WS2: Game engine (server)
- **Scope:** `src/server/evaluate.ts`, `puzzles.ts`, `plays.ts`, `hints.ts`, API routes `/guess`, `/giveup`, `/hint*`, `/today`, `/play`.
- **Accept:** Unit tests for every rule in 4.2 to 4.5, including co-director units, null box office, missing certification fallback, presence-based cast matching, duplicate guesses, guess after game over. Answer never appears in any response before finish (test asserts this).

### WS3: Call Sheet logic
- **Scope:** `src/lib/callsheet.ts`, `components/callsheet/*`.
- **Do:** Pure function `(feedback[]) => CallSheetState`. Interval intersection for year, box office (log), score. Confirmed / ruled-out sets for people, studio, rating, genres.
- **Accept:** Property tests: derived ranges always contain the true answer value when fed real feedback. UI matches Section 4.7.

### WS4: Design system and chrome
- **Scope:** `styles/*`, `components/chrome/*`, base primitives.
- **Do:** Extract tokens from SFA site source if available. Leader animation, nav, timecode clock, footer with TMDB attribution, fonts.
- **Accept:** Storybook or a `/dev/kitchen-sink` page showing every component state. Reduced motion respected. AA contrast.

### WS5: Game UI
- **Depends on:** WS2 contracts, WS3, WS4.
- **Scope:** `components/game/*`, `app/page.tsx`, `vault/*`, `p/[slug]`.
- **Accept:** Full round playable on desktop and 375px mobile. Keyboard-only playable. Resume after reload.

### WS6: Sharing
- **Scope:** `components/share/*`, `/api/og/*`.
- **Accept:** Share text matches 7.1 exactly. OG images render under 300ms. Web Share API on mobile, clipboard fallback, "Post to X" intent link.

### WS7: Accounts, stats, leaderboard
- **Scope:** auth flows, `/stats`, `/leaderboard`, `/settings`, `server/leaderboard.ts`, anon merge.
- **Accept:** Stats distribution covers takes 1 to 10 plus turnaround. Weekly board rule (3 of 7, loss = 11). "No notes" filter. Anti-cheat flags from Section 10.

### WS8: Pitch (custom challenges) and Admin
- **Scope:** `/pitch`, `/api/pitch*`, `/admin/*`, `scripts/schedule/*`.
- **Do:** Admin calendar to schedule puzzles 60 days ahead, swap films, preview hints, edit studio aliases, set themed weeks. Hint generator drafts 3 candidates per film from tagline, keywords, cast graph, awards (awards from a curated table), editable by hand.
- **Accept:** Cannot schedule a film used in the last 365 days. Cannot schedule a film missing required fields.

### WS9 (Phase 2+): Extra modes
- One agent per mode in Section 5, each in `app/modes/[mode]` + `server/modes/[mode].ts`, reusing search, share, and design primitives.

### WS10: QA
- Playwright e2e: win flow, loss flow, give up, hints, resume, share text, pitch flow, leaderboard eligibility, mobile layout.
- Leak test: script that plays a full day as anon and asserts the answer title and id never appear in any response body until the reveal.

---

## 13. Phased roadmap

| Phase | Contents | Exit criteria |
|---|---|---|
| **1. Premiere (MVP)** | WS0 to WS8: Classic daily, Call Sheet, hints, Vault, Pitch, share, stats, leaderboard, admin | 14 days of puzzles scheduled; leak test passes; Lighthouse 90+ mobile |
| **2. Wide release** | Unlimited, Opening Weekend, Release Order, themed weeks, light theme, daily global stats on result card | |
| **3. Franchise** | Casting Call, Logline, Double Feature (realtime), Frame Lock if licensing allows, PWA install, push reminder | |

---

## 14. Launch and growth notes

- Seed the first two weeks with high-recognition films so first-time players win and share.
- Themed week #1 tied to a current release or awards season.
- Share-first copy on the result card: "Post your take" button is primary.
- Post a daily "Reel No." recap on X from the official account at reset time (scheduled job), no spoilers.
- Optional later: a tasteful single sponsor slot styled as a "Presented by" title card. No ad stacks.

---

## 15. Legal and data

- TMDB: "This product uses the TMDB API but is not endorsed or certified by TMDB." Logo per their guidelines, in footer and How to Play.
- Posters and headshots served from TMDB's image CDN; do not rehost.
- Loglines, decade vibes, and awards blurbs are written in-house.
- No trademarks of studios used beyond factual logo display via TMDB company images.
- Privacy policy: anon cookie, optional account, privacy-friendly analytics, no third-party ad trackers.

---

## 16. Open questions (decide before or during Phase 1)

1. Final domain and X handle (name collision with the "Greenlit" producer-sim app).
2. Keep Score as an attribute, or swap for Runtime (stable, objective)? Default: keep Score (frozen), revisit after playtests.
3. Year close band: 3 years (current) vs 5 (Spotle). Playtest both.
4. Should Supporting matches reveal the answer role tag, or is that too generous?
5. Library size target: 4,000 searchable, ~1,500 answer-eligible?
6. Do we fold New Line, Focus, etc. into parents, or keep them as headline studios? Decide in `studio_aliases` review.
