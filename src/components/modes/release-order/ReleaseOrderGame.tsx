'use client';
// Release Order round UI (WS9, Section 5). Loads today's set from /api/modes/release-order,
// lets the player sort it, submits attempts, and shows per position feedback. Release dates are
// only ever rendered from `state.reveal`, which the server sends once the round is over.
import { useCallback, useEffect, useState } from 'react';
import '@/components/game/game.css';
import { COPY } from '@/config/brand';
import { Button, buttonClass, cx, Panel, Spinner, StatusGlyph, useToast, VisuallyHidden } from '@/components/ui';
import { canUseNativeShare, copyText, nativeShare, xIntentUrl } from '@/components/share/shareActions';
import { Poster } from '@/components/game/Poster';
import type {
  ReleaseOrderAttempt,
  ReleaseOrderCard,
  ReleaseOrderState,
  SlotVerdict,
} from '@/server/modes/release-order/types';
import { SortBoard } from './SortBoard';
import { buildReleaseOrderShare, releaseOrderScore, releaseOrderUrl } from './shareText';

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

function AttemptRow({ attempt, index, cards }: { attempt: ReleaseOrderAttempt; index: number; cards: ReleaseOrderCard[] }) {
  const byKey = new Map(cards.map((c) => [c.key, c]));
  return (
    <li className="flex flex-col gap-2" data-testid="ro-attempt">
      <p className="ty-label m-0">
        Take {index + 1}
        <span className="text-ink-dim"> · {summarizeAttempt(attempt)}</span>
      </p>
      <ol className="m-0 grid list-none grid-cols-5 gap-1 p-0">
        {attempt.order.map((key, pos) => {
          const v = attempt.feedback[pos]!;
          const title = byKey.get(key)?.title ?? '';
          return (
            <li
              key={pos}
              className="gl-status relative flex min-h-16 min-w-0 flex-col justify-between rounded-[3px] border-[1.5px] p-1.5"
              data-verdict={v}
              aria-label={`Position ${pos + 1}, ${title}, ${VERDICT_WORDS[v]}.`}
            >
              <span aria-hidden="true" className="flex items-start justify-between font-mono text-[11px] font-bold">
                <span>{pos + 1}</span>
                <StatusGlyph verdict={v} className="!text-[13px]" />
              </span>
              <span aria-hidden="true" className="line-clamp-2 text-[11px] leading-tight [overflow-wrap:anywhere]">
                {title}
              </span>
            </li>
          );
        })}
      </ol>
    </li>
  );
}

function SharePanel({ state }: { state: ReleaseOrderState }) {
  const { toast } = useToast();
  const text = buildReleaseOrderShare(state);
  const copy = async () => toast((await copyText(text)) ? 'Copied' : 'Could not copy. Select the preview text and copy it.');
  const post = async () => {
    if (canUseNativeShare()) {
      const r = await nativeShare({ text, url: releaseOrderUrl() });
      if (r !== 'failed') return;
    }
    await copy();
  };
  return (
    <Panel variant="sheet" head={<h2 className="ty-label m-0">Post your take</h2>} className="w-full">
      <div className="flex flex-col gap-4">
        <pre
          data-testid="ro-share-preview"
          aria-label="Share preview"
          className="m-0 overflow-x-auto whitespace-pre-wrap break-words rounded-[3px] border border-rule bg-bg p-3 font-mono text-sm leading-relaxed text-ink"
        >
          {text}
        </pre>
        <Button variant="slate" size="lg" block onClick={post}>
          Post your take
        </Button>
        <div className="grid gap-2 sm:grid-cols-2">
          <a href={xIntentUrl(text)} target="_blank" rel="noopener noreferrer" className={buttonClass('outline', 'md', true)}>
            <span>Post to X</span>
            <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
          </a>
          <Button variant="outline" block onClick={copy}>
            Copy text
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function Reveal({ state }: { state: ReleaseOrderState }) {
  const last = state.attempts[state.attempts.length - 1];
  const won = state.status === 'won';
  return (
    <section aria-labelledby="ro-result-heading" className="flex flex-col gap-4" data-testid="ro-result">
      <div>
        <p className="ty-label m-0">Release order · {releaseOrderScore(state)}</p>
        <h2
          id="ro-result-heading"
          tabIndex={-1}
          className={cx('ty-display mt-2 text-[length:var(--t-d2)]', won ? 'anim-stamp' : 'anim-flicker')}
        >
          {won ? COPY.winStamp : COPY.lossStamp}
        </h2>
        <p className="mt-2 text-ink-dim">
          {won
            ? `Sorted in ${state.attempts.length} of ${state.maxAttempts}.`
            : `Out of takes. Here is the true order.`}
        </p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0" aria-label="True release order, earliest first" data-testid="ro-reveal">
        {state.reveal!.map((entry, i) => {
          const finalPos = last ? last.order.indexOf(entry.key) : -1;
          const right = finalPos === i;
          return (
            <li key={entry.key} className="flex items-center gap-3 border-[1.5px] border-rule bg-surface p-2">
              <span className="ty-label w-6 shrink-0 text-center tabular-nums" aria-hidden="true">
                {i + 1}
              </span>
              <Poster title={entry.title} year={entry.releaseYear} posterPath={entry.posterPath} size="xs" />
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold leading-tight [overflow-wrap:anywhere]">
                  <span className="sr-only">{i + 1}: </span>
                  {entry.title}
                </p>
                <p className="ty-num m-0 mt-0.5 font-mono text-sm text-ink-dim" data-testid="ro-reveal-date">
                  {formatReleaseDate(entry.releaseDate, entry.releaseYear)}
                </p>
              </div>
              <span className="ty-label shrink-0 text-ink-dim">
                {right ? 'You had it' : finalPos >= 0 ? `You had ${finalPos + 1}` : ''}
              </span>
            </li>
          );
        })}
      </ol>
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
      <div role="alert" className="border-[1.5px] border-rule bg-surface p-5">
        <p className="ty-label m-0">Cut</p>
        <p className="mt-2 text-ink-dim">{loadError}</p>
        <Button variant="solid" className="mt-4" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="flex items-center gap-3 py-10 text-ink-dim">
        <Spinner label="Loading today's set" showLabel />
      </div>
    );
  }

  const finished = state.status !== 'in_progress';
  const lastAttempt = state.attempts[state.attempts.length - 1] ?? null;
  const take = Math.min(state.attempts.length + 1, state.maxAttempts);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" data-testid="ro-game" data-status={state.status}>
      <div className="flex min-w-0 flex-col gap-4">
        <p className="sr-only" aria-live="polite" data-testid="ro-status">
          {status}
        </p>
        {finished ? (
          <Reveal state={state} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="ty-label m-0" data-testid="ro-take">
                {COPY.takeLabel(take, state.maxAttempts)}
              </p>
              <p className="ty-label m-0 text-ink-dim">{state.dateLabel}</p>
            </div>
            <p className="m-0 text-ink-dim">
              Sort the five films from earliest release to latest. Drag a film by its grip, or use the up and down
              buttons. Green ✓ means the right slot, amber ≈ means one slot off.
            </p>
            <p className="ty-label m-0">Earliest</p>
            <SortBoard cards={state.cards} order={order} onChange={setOrder} lastAttempt={lastAttempt} disabled={submitting} />
            <p className="ty-label m-0">Latest</p>
            <Button variant="slate" size="lg" block onClick={() => void submit()} disabled={submitting} aria-busy={submitting || undefined}>
              {submitting ? 'Checking the order' : 'Lock this order'}
            </Button>
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        {finished ? <SharePanel state={state} /> : null}
        {state.attempts.length ? (
          <Panel head={<h2 className="ty-label m-0">Takes</h2>} aria-label="Your takes">
            <ol className="m-0 flex list-none flex-col gap-4 p-0">
              {state.attempts.map((a, i) => (
                <AttemptRow key={i} attempt={a} index={i} cards={state.cards} />
              ))}
            </ol>
          </Panel>
        ) : (
          <Panel head={<h2 className="ty-label m-0">How it works</h2>}>
            <ul className="m-0 flex list-disc flex-col gap-2 pl-5 text-ink-dim">
              <li>Same five films for everyone today.</li>
              <li>{state.maxAttempts} takes to get the order right.</li>
              <li>After each take, every slot shows ✓ right, ≈ one slot off, or blank for wrong.</li>
              <li>Release dates stay sealed until the round wraps.</li>
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
