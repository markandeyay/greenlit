import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, COPY } from '@/config/brand';
import { HINT_CANDIDATES_PER_PUZZLE, LAUNCH_DATE, LOSS_SCORE, RESET_TIMEZONE } from '@/config/game';
import { HINT_TYPE_LABELS, NOT_IN_SLOT_1 } from '@/config/hints';
import { RULES } from '@/config/rules';
import { Breadcrumb } from '@/components/chrome/Breadcrumb';
import { FilmMicrocopy } from '@/components/chrome/FilmMicrocopy';
import { SceneHeading } from '@/components/chrome/SceneHeading';
import { SlateMeta } from '@/components/chrome/SlateMeta';
import { TmdbAttribution } from '@/components/chrome/TmdbAttribution';
import { Chip } from '@/components/ui/Chip';
import { Accent } from '@/components/ui/Heading';
import { StatusCell } from '@/components/ui/StatusCell';
import { Tag } from '@/components/ui/Tag';
import type { HintType } from '@/lib/types';

export const metadata: Metadata = {
  title: 'How to play',
  description: `Rules, color guide and attribute guide for ${APP_NAME}.`,
};

const city = (RESET_TIMEZONE.split('/').pop() ?? RESET_TIMEZONE).replace(/_/g, ' ');
const greenPct = Math.round(RULES.boxOfficeGreenPct * 100);
const closeRatio = `${RULES.boxOfficeCloseRatio}x`;
const [note1, note2] = RULES.hintUnlockAfter;
const hintsTitle = COPY.hintsName.replace(/(\S+)$/, '*$1*');
const noteTypes = (Object.keys(HINT_TYPE_LABELS) as HintType[]).filter((t) => t !== 'creator_note');

interface AttrRow {
  cell: string;
  shows: string;
  green: string;
  yellow: string;
  gray: string;
  word: string;
}

/** Section 4.2, with every threshold read from RULES. */
const ATTRIBUTES: AttrRow[] = [
  {
    cell: 'Director',
    shows: 'One directing credit. Co-directors count as one unit.',
    green: 'Same credit, or any shared director in a co-directing unit',
    yellow: 'Never',
    gray: 'No shared director',
    word: 'None',
  },
  {
    cell: 'Lead',
    shows: 'The top-billed actor',
    green: "This actor is anywhere in the answer's billed cast",
    yellow: 'Never',
    gray: 'Not in the cast',
    word: 'None',
  },
  {
    cell: 'Supporting',
    shows: `Up to ${RULES.maxSupportingCast} actors, one cell each`,
    green: "This actor is anywhere in the answer's billed cast",
    yellow: 'Never',
    gray: 'Not in the cast',
    word: 'None',
  },
  {
    cell: 'Year',
    shows: 'Theatrical release year',
    green: 'Exact',
    yellow: `Within ${RULES.yearClose} years`,
    gray: `More than ${RULES.yearClose} years off`,
    word: 'LATER / EARLIER',
  },
  {
    cell: 'Box office',
    shows: 'Worldwide gross, nominal USD',
    green: `Within ${greenPct}%`,
    yellow: `Within ${closeRatio} either way`,
    gray: 'Further',
    word: 'BIGGER / SMALLER',
  },
  {
    cell: 'Rating',
    shows: 'Certification for your region',
    green: 'Same',
    yellow: 'Never',
    gray: 'Different',
    word: 'None',
  },
  {
    cell: 'Studio',
    shows: 'The headline studio',
    green: 'Same studio',
    yellow: 'Never',
    gray: 'Different',
    word: 'None',
  },
  {
    cell: 'Score',
    shows: 'TMDB vote average x10, frozen when the film was added',
    green: 'Exact',
    yellow: `Within ${RULES.scoreClose} points`,
    gray: 'Further',
    word: 'HIGHER / LOWER',
  },
  {
    cell: 'Genres',
    shows: '1 to 5 genres, shown as chips',
    green: 'Each matching chip',
    yellow: 'Never',
    gray: 'Each chip that does not match',
    word: 'None',
  },
];

export default function HowToPlayPage() {
  return (
    <main className="l-page gl-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumb items={[{ label: APP_NAME, href: '/' }, { label: 'How to play' }]} />
        <FilmMicrocopy />
      </div>

      <div className="mt-10">
        <SlateMeta roll={LAUNCH_DATE.slice(0, 4)} scene={0} take={1} decorative />
        <h1 className="ty-display mt-3 text-[length:var(--t-d1)]">
          How to <Accent>play</Accent>
        </h1>
        <p className="ty-lede mt-5 text-ink-dim">
          One mystery film a day, the same for everyone. You get {RULES.maxGuesses} takes. Every take tells you
          how your film compares, and the Call Sheet keeps track of it all.
        </p>
      </div>

      {/* 01 */}
      <section className="gl-section mt-16" aria-labelledby="htp-premise">
        <SceneHeading n={1} slug="INT. THE SCREENING ROOM - NIGHT" title="The *premise*" id="htp-premise" meta="Same film, whole world, one day" />
        <div className="gl-section__body prose-film">
          <ol className="grid gap-3 list-decimal pl-5">
            <li>Type a title into the search box and pick a film. Picking it submits your take.</li>
            <li>
              Your take comes back as a row of cells comparing your film with the mystery film: director, cast, year,
              box office, rating, studio, score and genres.
            </li>
            <li>Use what you learn to choose the next film. The Call Sheet sums up everything so far.</li>
            <li>
              Find the film within {RULES.maxGuesses} takes and it is <strong>{COPY.winStamp}</strong>. Run out of
              takes, or choose <strong>{COPY.giveUp}</strong>, and it is <strong>{COPY.lossStamp}</strong>.
            </li>
            <li>A new reel goes up every day at midnight, {city} time.</li>
          </ol>
        </div>
      </section>

      {/* 02 */}
      <section className="gl-section" aria-labelledby="htp-colors">
        <SceneHeading n={2} slug="INT. THE LAB - DAY" title="The *colors*" id="htp-colors" meta="One color means one thing" />
        <div className="gl-section__body">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatusCell verdict="match" label="Year" value="2010" />
            <StatusCell verdict="close" label="Year" value="2008" direction="LATER" />
            <StatusCell verdict="miss" label="Year" value="1994" direction="LATER" />
            <StatusCell verdict="na" label="Box office" value="N/A" />
          </div>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2 prose-film">
            <div>
              <dt className="ty-label text-ink">✓ Green: match</dt>
              <dd className="mt-1">Confirmed. The whole cell fills, for people as well as numbers.</dd>
            </div>
            <div>
              <dt className="ty-label text-ink">≈ Yellow: close</dt>
              <dd className="mt-1">Numbers only (year, box office, score). Close, but not exact.</dd>
            </div>
            <div>
              <dt className="ty-label text-ink">Gray: no match</dt>
              <dd className="mt-1">Not this. People, rating and studio are only ever green or gray.</dd>
            </div>
            <div>
              <dt className="ty-label text-ink">Dashed: not available</dt>
              <dd className="mt-1">
                Box office is unknown for one of the films. It shows N/A and is left out of the Call Sheet.
              </dd>
            </div>
          </dl>
          <div className="prose-film mt-6">
            <p>
              <strong>Words, not arrows.</strong> Yellow and gray number cells say which way to go: LATER or EARLIER
              for year, BIGGER or SMALLER for box office, HIGHER or LOWER for score. The word always describes the
              mystery film. Green cells show no word.
            </p>
            <p>
              A matched cast member gets a small <Tag>LEAD</Tag> or <Tag>SUPP</Tag> tag showing where they sit in the
              mystery film. It is information, not a color. Genre chips light up one by one:{' '}
              <Chip status="match">Sci-Fi</Chip> <Chip status="miss">Comedy</Chip>
            </p>
            <p>
              Prefer blue and orange with patterns? Turn on colorblind mode in <Link href="/settings">Settings</Link>.
            </p>
          </div>
        </div>
      </section>

      {/* 03 */}
      <section className="gl-section" aria-labelledby="htp-attributes">
        <SceneHeading n={3} slug="INT. THE CASTING OFFICE - DAY" title="The *attributes*" id="htp-attributes" meta="Twelve cells per take" />
        <div className="gl-section__body">
          <div className="gl-sheet__scroll" role="region" aria-label="Attribute guide table" tabIndex={0}>
            <table className="gl-sheet min-w-[720px]">
              <caption>Attribute guide · {COPY.callSheet}</caption>
              <thead>
                <tr>
                  <th scope="col">Cell</th>
                  <th scope="col">Shows</th>
                  <th scope="col">✓ Green</th>
                  <th scope="col">≈ Yellow</th>
                  <th scope="col">Gray</th>
                  <th scope="col">Word</th>
                </tr>
              </thead>
              <tbody>
                {ATTRIBUTES.map((a) => (
                  <tr key={a.cell}>
                    <th scope="row">{a.cell}</th>
                    <td>{a.shows}</td>
                    <td>{a.green}</td>
                    <td className={a.yellow === 'Never' ? 'text-ink-dim' : undefined}>{a.yellow}</td>
                    <td>{a.gray}</td>
                    <td className="font-mono">{a.word}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="prose-film mt-6 grid gap-2 list-disc pl-5">
            <li>
              Cast matching is about presence: if your lead appears anywhere in the mystery film&apos;s cast, lead or
              supporting, the cell goes green.
            </li>
            <li>
              Films with fewer than {RULES.maxSupportingCast} supporting actors show the empty slots as dashed
              outlines.
            </li>
            <li>
              If the mystery film has no rating in your region, the US rating is used and a small <Tag>US</Tag> tag
              appears.
            </li>
            <li>Box office closeness is a ratio, so it is fair to small films and blockbusters alike.</li>
          </ul>
        </div>
      </section>

      {/* 04 */}
      <section className="gl-section" aria-labelledby="htp-callsheet">
        <SceneHeading n={4} slug="INT. THE CALL SHEET - NIGHT" title="The *Call Sheet*" id="htp-callsheet" meta="It remembers so you do not have to" />
        <div className="gl-section__body prose-film">
          <p>
            The Call Sheet is built only from the feedback you have received. It narrows the year, box office and
            score to a range, lists confirmed people, rating, studio and genres as <strong>{COPY.confirmed}</strong>,
            and strikes through everything ruled out as <strong>{COPY.ruledOut}</strong>.
          </p>
          <p>
            Every take also tells you how many genres the mystery film has, so the sheet can say, for example,
            &ldquo;3 genres total.&rdquo; Tap a Call Sheet row to highlight the takes that taught you it.
          </p>
        </div>
      </section>

      {/* 05 */}
      <section className="gl-section" aria-labelledby="htp-notes">
        <SceneHeading n={5} slug="INT. THE WRITERS ROOM - NIGHT" title={hintsTitle} id="htp-notes" meta="Two optional hints" />
        <div className="gl-section__body prose-film">
          <p>
            Note 1 unlocks after take {note1}. Note 2 unlocks after take {note2}. Each reel has{' '}
            {HINT_CANDIDATES_PER_PUZZLE} possible notes. When a note unlocks you choose one of the remaining notes
            by its type, without seeing what it says, and then reveal it.
          </p>
          <p>Note types:</p>
          <ul className="flex flex-wrap gap-2" aria-label="Note types">
            {noteTypes.map((t) => (
              <li key={t}>
                <Chip>
                  {HINT_TYPE_LABELS[t]}
                  {NOT_IN_SLOT_1.includes(t) ? ' (Note 2 only)' : ''}
                </Chip>
              </li>
            ))}
          </ul>
          <p>
            Notes never change your take count, but they are recorded: your share shows a 📝 and leaderboards have a
            no-notes filter.
          </p>
        </div>
      </section>

      {/* 06 */}
      <section className="gl-section" aria-labelledby="htp-score">
        <SceneHeading n={6} slug="INT. THE CUTTING ROOM - DAY" title="The *score*" id="htp-score" meta="Fewer takes is better" />
        <div className="gl-section__body prose-film">
          <p>
            Your score is the number of takes you used, from 1 to {RULES.maxGuesses}. A reel sent to turnaround
            counts as {LOSS_SCORE} when averages are worked out.
          </p>
          <p>
            Sharing is spoiler free: your result is a grid of squares with no titles. Past reels live in{' '}
            <Link href="/vault">the Vault</Link>; Vault plays are tracked separately and earn no leaderboard credit.
          </p>
        </div>
      </section>

      {/* 07 */}
      <section className="gl-section" aria-labelledby="htp-credits">
        <SceneHeading n={7} slug="EXT. THE BACK LOT - DAY" title="The *credits*" id="htp-credits" meta="Where the film data comes from" />
        <div className="gl-section__body">
          <p className="prose-film">
            Posters, credits, release dates, ratings, box office and scores come from TMDB.
          </p>
          <TmdbAttribution className="!mx-0 !items-start text-left" />
        </div>
      </section>
    </main>
  );
}
