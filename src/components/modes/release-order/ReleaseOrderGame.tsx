'use client';
// Release Order round UI (WS9, Section 5). Loads today's set from /api/modes/release-order,
// lets the player sort it, submits attempts, and shows per position feedback. Release dates are
// only ever rendered from `state.reveal`, which the server sends once the round is over.
import { useCallback, useEffect, useState } from 'react';
import '@/components/game/game.css';
import { COPY } from '@/config/brand';
import { Button, cx, Spinner, useToast } from '@/components/ui';
import { ShareArtifactPanel } from '@/components/share';
import { Poster } from '@/components/game/Poster';
import type { ReleaseOrderAttempt, ReleaseOrderCard, ReleaseOrderState, SlotVerdict } from '@/server/modes/release-order/types';
import { SLOT_GLYPH, SortBoard } from './SortBoard';
import { releaseOrderArtifact, releaseOrderScore } from './shareText';

export const RELEASE_ORDER_API = '/api/modes/release-order';

const VERDICT_WORDS: Record<SlotVerdict, string> = { match: 'right slot', close: 'one slot off', miss: 'wrong slot' };

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function readJson(res: Response): Promise<ReleaseOrderState> {
  const body = (await res.json().catch(() => ({}))) as ReleaseOrderState & ApiErrorBody;
  if (!res.ok) throw new Error(body.error?.message ?? 'Something went wrong. Try again.');
  return body;
}

export function formatReleaseDate(releaseDate: string | null, releaseYear: number): string {
  if (!releaseDate) return String(releaseYear);
  return new Date(`${releaseDate}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function summarizeAttempt(a: ReleaseOrderAttempt): string {
  const right = a.feedback.filter((v) => v === 'match').length;
  const close = a.feedback.filter((v) => v === 'close').length;
  return `${right} in the right slot, ${close} one slot off`;
}

/** One past take as a row of five verdict squares (glyph in each, words for screen readers). */
function AttemptRow({ attempt, index, cards }: { attempt: ReleaseOrderAttempt; index: number; cards: ReleaseOrderCard[] }) {
  const byKey = new Map(cards.map((c) => [c.key, c]));
  return (
    <li className="flex items-center gap-3" data-testid="ro-attempt">
      <span className="w-14 shrink-0 font-mono text-[12px] font-bold uppercase">Take {index + 1}</span>
      <ol className="m-0 flex list-none gap-1 p-0">
        {attempt.order.map((key, pos) => {
          const v = attempt.feedback[pos]!;
          const title = byKey.get(key)?.title ?? '';
          return (
            <li
              key={pos}
              className="gl-status grid h-8 w-8 place-items-center rounded-[4px] border-[1.5px] text-[14px] font-bold"
              data-verdict={v}
              aria-label={`Position ${pos + 1}, ${title}, ${VERDICT_WORDS[v]}.`}
            >
              <span aria-hidden="true">{SLOT_GLYPH[v]}</span>
            </li>
          );
        })}
      </ol>
      <span className="min-w-0 text-[13px] leading-tight text-ink-dim">{summarizeAttempt(attempt)}</span>
    </li>
  );
}

function Takes({ state }: { state: ReleaseOrderState }) {
  if (!state.attempts.length) return null;
  return (
    <section aria-label="Your takes">
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {state.attempts.map((a, i) => (
          <AttemptRow key={i} attempt={a} index={i} cards={state.cards} />
        ))}
      </ol>
    </section>
  );
}

function Result({ state }: { state: ReleaseOrderState }) {
  const last = state.attempts[state.attempts.length - 1];
  const won = state.status === 'won';
  const artifact = releaseOrderArtifact(state);
  return (
    <section aria-labelledby="ro-result-heading" className="flex flex-col gap-5" data-testid="ro-result">
      <div>
        <p className="m-0 font-mono text-[12px] font-bold tracking-[0.12em] uppercase">
          {won ? '✓' : '✗'} Release order · {releaseOrderScore(state)}
        </p>
        <h2
          id="ro-result-heading"
          tabIndex={-1}
          className={cx('ty-display m-0 mt-1 text-[clamp(34px,9vw,56px)] leading-none outline-none', won ? 'anim-stamp' : 'anim-flicker')}
        >
          {won ? COPY.winStamp : COPY.lossStamp}
        </h2>
        <p className="m-0 mt-2 text-ink-dim">
          {won ? `Sorted in ${state.attempts.length} of ${state.maxAttempts}.` : 'Out of takes. Here is the real order.'} New set at
          midnight New York time.
        </p>
      </div>
      <div className="min-w-0 [&_pre]:break-words [&_pre]:whitespace-pre-wrap" data-testid="ro-share" data-share-text={artifact.text}>
        <ShareArtifactPanel artifact={artifact} />
      </div>
      <div>
        <h3 className="m-0 mb-2 font-mono text-[12px] font-bold tracking-[0.12em] uppercase">The real order</h3>
        <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label="True release order, oldest first" data-testid="ro-reveal">
          {state.reveal!.map((entry, i) => {
            const finalPos = last ? last.order.indexOf(entry.key) : -1;
            const right = finalPos === i;
            return (
              <li key={entry.key} className="flex items-center gap-3 rounded-[6px] border-2 border-rule bg-surface p-2">
                <span className="w-5 shrink-0 text-center font-mono text-[15px] font-bold tabular-nums" aria-hidden="true">
                  {i + 1}
                </span>
                <Poster title={entry.title} year={entry.releaseYear} posterPath={entry.posterPath} size="xs" />
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[15px] leading-tight font-semibold [overflow-wrap:anywhere]">
                    <span className="sr-only">{i + 1}: </span>
                    {entry.title}
                  </p>
                  <p className="ty-num m-0 mt-0.5 font-mono text-[13px] text-ink-dim" data-testid="ro-reveal-date">
                    {formatReleaseDate(entry.releaseDate, entry.releaseYear)}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[12px] font-bold">
                  {right ? '✓ You had it' : finalPos >= 0 ? `✗ You had ${finalPos + 1}` : ''}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <Takes state={state} />
    </section>
  );
}

export function ReleaseOrderGame() {
  const { toast } = useToast();
  const [state, setState] = useState<ReleaseOrderState | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');

  const adopt = useCallback((next: ReleaseOrderState) => {
    setState(next);
    const last = next.attempts[next.attempts.length - 1];
    setOrder(last ? [...last.order] : next.cards.map((c) => c.key));
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      adopt(await readJson(await fetch(RELEASE_ORDER_API, { cache: 'no-store', credentials: 'same-origin' })));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load today’s set.');
    }
  }, [adopt]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of server state
    void load();
  }, [load]);

  const submit = async () => {
    if (!state || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(RELEASE_ORDER_API, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ date: state.date, order }),
      });
      const next = await readJson(res);
      adopt(next);
      const a = next.attempts[next.attempts.length - 1]!;
      if (next.status === 'won') setStatus(`${COPY.winStamp}. Sorted in ${next.attempts.length}.`);
      else if (next.status === 'lost') setStatus(`${COPY.lossStamp}. The true order is shown.`);
      else setStatus(`Take ${next.attempts.length}: ${summarizeAttempt(a)}. ${next.maxAttempts - next.attempts.length} left.`);
      if (next.status !== 'in_progress') {
        requestAnimationFrame(() => document.getElementById('ro-result-heading')?.focus());
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className="rounded-[6px] border-2 border-rule bg-surface p-5">
        <p className="m-0 font-semibold">Could not load today&apos;s set</p>
        <p className="mt-2 text-ink-dim">{loadError}</p>
        <Button variant="solid" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-ink-dim">
        <Spinner label="Loading today's set" showLabel />
      </div>
    );
  }

  const finished = state.status !== 'in_progress';
  const lastAttempt = state.attempts[state.attempts.length - 1] ?? null;
  const take = Math.min(state.attempts.length + 1, state.maxAttempts);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3" data-testid="ro-game" data-status={state.status}>
      <p className="sr-only" aria-live="polite" data-testid="ro-status">
        {status}
      </p>
      {finished ? (
        <Result state={state} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 font-mono text-[13px] font-bold" data-testid="ro-take">
              {COPY.takeLabel(take, state.maxAttempts)}
            </p>
            <p className="m-0 font-mono text-[12px] tracking-[0.1em] text-ink-dim uppercase">
              <span aria-hidden="true">▲ </span>Oldest on top
            </p>
          </div>
          <SortBoard cards={state.cards} order={order} onChange={setOrder} lastAttempt={lastAttempt} disabled={submitting} />
          <Takes state={state} />
          <div
            className={cx(
              'sticky bottom-0 z-20 -mx-[var(--margin)] mt-1 border-t border-rule bg-bg/95 px-[var(--margin)] pt-3 backdrop-blur-sm',
              'pb-[max(12px,env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:backdrop-blur-none',
            )}
          >
            <Button
              variant="slate"
              size="lg"
              block
              onClick={() => void submit()}
              disabled={submitting}
              aria-busy={submitting || undefined}
            >
              {submitting ? 'Checking...' : 'Lock this order'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
