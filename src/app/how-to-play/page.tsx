import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME, COPY } from '@/config/brand';
import { HINT_CANDIDATES_PER_PUZZLE, LOSS_SCORE, RESET_TIMEZONE } from '@/config/game';
import { HINT_TYPE_LABELS, NOT_IN_SLOT_1 } from '@/config/hints';
import { RULES } from '@/config/rules';
import { splitEndCredits } from '@/components/chrome/Footer';
import { PageHeader } from '@/components/chrome/PageHeader';
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
  const { end, credit } = splitEndCredits();
  const [endFirst, ...endRest] = end.split(' ');
  return (
    <main className="l-page gl-page max-w-[820px]!">
      <PageHeader
        title={
          <>
            How to <Accent>play</Accent>
          </>
        }
        lede={`Guess the mystery film in ${RULES.maxGuesses} takes. Every take shows how close you are.`}
      />

      <section className="gl-example mt-6" aria-labelledby="htp-example">
        <h2 id="htp-example" className="ty-label">
          Example take
        </h2>
        <p className="font-semibold">You guessed a film from 2008 that made $90M.</p>
        <div className="gl-example__cells">
          <StatusCell verdict="match" label="Studio" value="Warner" />
          <StatusCell verdict="close" label="Year" value="2008" direction="LATER" />
          <StatusCell verdict="miss" label="Box office" value="$90M" direction="BIGGER" />
          <StatusCell verdict="miss" label="Rating" value="R" />
        </div>
        <p className="text-[15px] text-ink-dim">
          So the mystery film is from the same studio, came out a little later than 2008, made more than $90M, and is
          not rated R.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="htp-colors">
        <h2 id="htp-colors" className="gl-h2">
          What the colors mean
        </h2>
        <ul className="gl-legend mt-4">
          <li>
            <span className="gl-legend__swatch" data-verdict="match" aria-hidden="true">
              ✓
            </span>
            <span>
              <strong>Green: match.</strong> <span className="text-ink-dim">Exactly right.</span>
            </span>
          </li>
          <li>
            <span className="gl-legend__swatch" data-verdict="close" aria-hidden="true">
              ≈
            </span>
            <span>
              <strong>Yellow: close.</strong>{' '}
              <span className="text-ink-dim">Numbers only: year, box office and score.</span>
            </span>
          </li>
          <li>
            <span className="gl-legend__swatch" data-verdict="miss" aria-hidden="true" />
            <span>
              <strong>Gray: no match.</strong> <span className="text-ink-dim">Not this one.</span>
            </span>
          </li>
          <li>
            <span className="gl-legend__swatch" data-verdict="na" aria-hidden="true">
              N/A
            </span>
            <span>
              <strong>Dashed: unknown.</strong> <span className="text-ink-dim">No data for one of the films.</span>
            </span>
          </li>
        </ul>
        <p className="mt-4 max-w-[var(--measure)] text-[15px] text-ink-dim">
          Number cells say which way to go: LATER or EARLIER, BIGGER or SMALLER, HIGHER or LOWER. Prefer blue and
          orange with patterns? Turn on colorblind mode in{' '}
          <Link href="/settings" className="font-semibold text-accent-ink underline underline-offset-2">
            Settings
          </Link>
          .
        </p>
      </section>

      <section className="mt-8" aria-labelledby="htp-steps">
        <h2 id="htp-steps" className="gl-h2">
          The basics
        </h2>
        <ol className="prose-film mt-4 grid list-decimal gap-2 pl-5">
          <li>Type a title and pick a film. That is one take.</li>
          <li>Read the cells, then pick a better film. The Call Sheet sums up everything you have learned.</li>
          <li>
            Find it within {RULES.maxGuesses} takes and it is <strong>{COPY.winStamp}</strong>. Run out, or choose{' '}
            {COPY.giveUp}, and it is <strong>{COPY.lossStamp}</strong>.
          </li>
          <li>Everyone gets the same film. A new reel goes up at midnight, {city} time.</li>
        </ol>
      </section>

      <section className="mt-10" aria-label="Details">
        <details className="gl-details">
          <summary>Every cell, explained</summary>
          <div className="gl-details__body">
            <ul className="gl-attrs">
              {ATTRIBUTES.map((a) => (
                <li key={a.cell}>
                  <p className="font-bold">{a.cell}</p>
                  <p className="text-ink-dim">{a.shows}</p>
                  <dl>
                    <dt>✓ Green</dt>
                    <dd>{a.green}</dd>
                    {a.yellow !== 'Never' ? (
                      <>
                        <dt>≈ Yellow</dt>
                        <dd>{a.yellow}</dd>
                      </>
                    ) : null}
                    <dt>Gray</dt>
                    <dd>{a.gray}</dd>
                    {a.word !== 'None' ? (
                      <>
                        <dt>Word</dt>
                        <dd className="font-mono">{a.word}</dd>
                      </>
                    ) : null}
                  </dl>
                </li>
              ))}
            </ul>
            <ul className="prose-film mt-4 grid list-disc gap-2 pl-5">
              <li>
                Cast is about presence: if your lead appears anywhere in the mystery film&apos;s cast, the cell goes
                green. A small <Tag>LEAD</Tag> or <Tag>SUPP</Tag> tag shows where they sit.
              </li>
              <li>
                Films with fewer than {RULES.maxSupportingCast} supporting actors show the empty slots as dashed
                outlines.
              </li>
              <li>
                No rating in your region? The US rating is used and a small <Tag>US</Tag> tag appears.
              </li>
              <li>
                Genre chips light up one by one: <Chip status="match">Sci-Fi</Chip> <Chip status="miss">Comedy</Chip>
              </li>
            </ul>
          </div>
        </details>

        <details className="gl-details">
          <summary>The Call Sheet</summary>
          <div className="gl-details__body prose-film">
            <p>
              The Call Sheet is built only from feedback you have received. It narrows year, box office and score to
              a range, lists what is <strong>{COPY.confirmed}</strong>, and strikes through what is{' '}
              <strong>{COPY.ruledOut}</strong>.
            </p>
            <p>
              Every take also tells you how many genres the mystery film has. Tap a Call Sheet row to highlight the
              takes that taught you it.
            </p>
          </div>
        </details>

        <details className="gl-details">
          <summary>{COPY.hintsName}</summary>
          <div className="gl-details__body prose-film">
            <p>
              Two optional hints. Note 1 unlocks after take {note1}, note 2 after take {note2}. Each reel has{' '}
              {HINT_CANDIDATES_PER_PUZZLE} possible notes; you pick one by its type, then reveal it.
            </p>
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
            <p>Notes never cost a take, but your share shows a 📝 and leaderboards have a no-notes filter.</p>
          </div>
        </details>

        <details className="gl-details">
          <summary>Scoring and sharing</summary>
          <div className="gl-details__body prose-film">
            <p>
              Your score is the number of takes you used, from 1 to {RULES.maxGuesses}. A reel sent to turnaround
              counts as {LOSS_SCORE} in averages.
            </p>
            <p>
              Box office is green within {greenPct}% and close within {closeRatio} either way, so it is fair to small
              films and blockbusters alike.
            </p>
            <p>
              Sharing is spoiler free: a grid of squares, no titles. Past reels live in{' '}
              <Link href="/vault">the Vault</Link>; Vault plays earn no leaderboard credit.
            </p>
          </div>
        </details>
      </section>

      <section className="mt-10" aria-labelledby="htp-credits">
        <h2 id="htp-credits" className="sr-only">
          Film data
        </h2>
        <p className="mb-3 text-[15px] text-ink-dim">
          Posters, credits, release dates, ratings, box office and scores come from TMDB.
        </p>
        <TmdbAttribution />
      </section>

      <div className="gl-theend" aria-hidden="true">
        <p className="gl-theend__big">
          {endRest.length > 0 ? (
            <>
              <Accent>{endFirst}</Accent> {endRest.join(' ')}
            </>
          ) : (
            end
          )}
        </p>
        {credit ? <p className="ty-label">{credit}</p> : null}
      </div>
    </main>
  );
}
