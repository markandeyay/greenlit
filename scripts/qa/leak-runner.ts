// Leak test runner (WS10, Section 10, Phase 1 exit criterion). Plays a full daily round as a
// fresh anonymous player in a real Chromium against a running server (a production build, so the
// JS chunks are the real ones), records every response, and reports any place the answer's title,
// tagline or TMDB id shows up before the reveal.
//
// Used by tests/e2e/leak.spec.ts (part of `pnpm test:e2e`) and scripts/qa/leak-test.ts (standalone).
//
// Exclusions, by design:
// - `/search-index.json` and `/api/search` list every playable film (Section 9: "Contains every
//   playable film, so it reveals nothing"), so the answer's title and id are always in them. They are
//   skipped entirely. Wrong guesses never type a prefix of the answer, so /api/search is only hit
//   with unrelated queries anyway.
// - Guess feedback carries the GUESSED film's title and id; we never guess the answer early, so it
//   cannot match.
// - A requested Script Note may legitimately be the tagline, so the runner never picks the
//   `tagline` note type, and scans hint responses for title and id only.
import type { Browser, Page, Response } from '@playwright/test';
import { STORAGE_KEYS } from '../../src/config/game';
import { RULES } from '../../src/config/rules';
import { HINT_TYPE_LABELS } from '../../src/config/hints';
import type { HintType } from '../../src/lib/types';
import {
  buildNeedles,
  decodeSignedCookie,
  findIdInJson,
  findLibraryInChunk,
  findTitle,
  scanCaptured,
  type LeakFinding,
  type LibraryLike,
} from './leak-scan';

export interface LeakFilm {
  id: number;
  title: string;
  releaseYear: number;
  tagline: string | null;
}

export interface LeakRunOptions {
  browser: Browser;
  baseURL: string;
  answer: LeakFilm;
  /** Wrong films to guess, at least RULES.maxGuesses - 1. Never the answer. */
  wrong: LeakFilm[];
  library: LibraryLike;
  /** Optional per-step logger. */
  log?: (msg: string) => void;
}

export interface CapturedResponse {
  url: string;
  status: number;
  contentType: string;
  resourceType: string;
  phase: 'before' | 'after';
  body: string;
  bytes: number;
  /** The browser never delivered a body (aborted by a navigation, or timed out). */
  unreadable?: boolean;
}

export interface LeakReport {
  answer: { id: number; title: string };
  responses: CapturedResponse[];
  /** Findings before the reveal: must be empty. */
  findings: LeakFinding[];
  /** Positive control: the reveal must contain the answer, proving the scanner works. */
  revealFindings: LeakFinding[];
  /** Pages and APIs visited before the reveal. */
  visited: string[];
  cookieChecks: { glPlaysHttpOnly: boolean | null; documentCookie: string };
  counts: { before: number; after: number; js: number; css: number; html: number; rsc: number; json: number; images: number; unreadable: number };
}

const BODY_TIMEOUT_MS = 5_000;

const EXCLUDED = [/\/search-index\.json(\?|$)/, /\/api\/search(\?|$)/];

function isExcluded(url: string): boolean {
  return EXCLUDED.some((re) => re.test(url));
}

function isTextual(contentType: string, url: string): boolean {
  return (
    /text\/|json|javascript|ecmascript|x-component|xml|svg|css/.test(contentType) ||
    /\.(js|css|json|html|txt|svg)(\?|$)/.test(url)
  );
}

const LEADER_INIT = (key: string) => {
  try {
    const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    window.localStorage.setItem(key, d);
  } catch {
    /* ignore */
  }
};

async function guessViaUi(page: Page, film: LeakFilm): Promise<void> {
  const rows = page.locator('article[data-take]');
  const before = await rows.count();
  const input = page.getByRole('combobox', { name: /Name a film/i });
  await input.click();
  await input.fill(film.title);
  const option = page.getByRole('option').filter({ hasText: film.title }).filter({ hasText: String(film.releaseYear) }).first();
  await option.waitFor({ state: 'visible', timeout: 15_000 });
  const res = page.waitForResponse((r) => r.url().includes('/api/guess') && r.request().method() === 'POST');
  await option.click();
  const r = await res;
  if (r.status() !== 200) throw new Error(`guess ${film.title} failed: HTTP ${r.status()} ${await r.text()}`);
  await rows.nth(before).waitFor({ state: 'attached', timeout: 15_000 });
}

/** Reveal a Script Note through the UI, never picking the tagline type. Returns the picked type or null. */
async function revealNote(page: Page, slot: 1 | 2): Promise<HintType | null> {
  const legend = page.locator('fieldset').filter({ has: page.locator('legend', { hasText: `Note ${slot}: choose a note` }) });
  if ((await legend.count()) === 0) return null;
  const radios = legend.getByRole('radio');
  const n = await radios.count();
  for (let i = 0; i < n; i++) {
    const value = (await radios.nth(i).getAttribute('value')) as HintType | null;
    if (!value || value === 'tagline') continue;
    await legend.getByText(HINT_TYPE_LABELS[value], { exact: true }).click();
    const res = page.waitForResponse((r) => r.url().includes('/api/hint') && r.request().method() === 'POST');
    await legend.getByRole('button', { name: `Reveal note ${slot}` }).click();
    await res;
    return value;
  }
  return null;
}

export async function runLeakTest(opts: LeakRunOptions): Promise<LeakReport> {
  const { browser, baseURL, answer, wrong, library } = opts;
  const log = opts.log ?? (() => {});
  if (wrong.length < RULES.maxGuesses - 1) throw new Error('Not enough wrong films');
  if (wrong.some((f) => f.id === answer.id)) throw new Error('Wrong films include the answer');

  const needles = buildNeedles(answer);
  const responses: CapturedResponse[] = [];
  const pending: Promise<void>[] = [];
  const visited: string[] = [];
  let phase: 'before' | 'after' = 'before';

  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { 'x-forwarded-for': `10.250.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  });
  await context.addInitScript(LEADER_INIT, STORAGE_KEYS.leaderSeen);

  const capture = (res: Response) => {
    const at = phase; // decided synchronously when the response arrives
    const req = res.request();
    const headers = res.headers();
    const contentType = (headers['content-type'] ?? '').toLowerCase();
    const entry: CapturedResponse = {
      url: res.url(),
      status: res.status(),
      contentType,
      resourceType: req.resourceType(),
      phase: at,
      body: '',
      bytes: 0,
    };
    responses.push(entry);
    if (res.status() >= 300 && res.status() < 400) return;
    // A body can stay pending forever when its page navigated away mid-stream, so cap the wait.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>((resolve) => {
      timer = setTimeout(() => resolve('timeout'), BODY_TIMEOUT_MS);
    });
    pending.push(
      Promise.race([res.body(), timeout])
        .then((buf) => {
          if (buf === 'timeout') {
            entry.unreadable = true;
            return;
          }
          entry.bytes = buf.length;
          if (isTextual(contentType, entry.url)) entry.body = buf.toString('utf8');
        })
        .catch(() => {
          // Body unavailable (e.g. navigated away before it finished); the URL is still scanned.
          entry.unreadable = true;
        })
        .finally(() => clearTimeout(timer)),
    );
  };
  context.on('response', capture);

  const page = await context.newPage();
  const settle = async () => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await Promise.all(pending.splice(0));
  };

  try {
    // 1. Today, fresh player.
    log('open /');
    await page.goto('/');
    visited.push('/');
    await page.getByRole('combobox', { name: /Name a film/i }).waitFor({ timeout: 30_000 });

    // OG and Twitter images referenced in meta tags.
    const metaImages = await page.$$eval('meta[property="og:image"], meta[name="twitter:image"]', (els) =>
      els.map((e) => e.getAttribute('content') ?? ''),
    );

    // 2. Wrong takes up to the last one, revealing notes when they unlock.
    const hintTakes = new Map<number, 1 | 2>(RULES.hintUnlockAfter.map((t, i) => [t, (i + 1) as 1 | 2]));
    for (let i = 0; i < RULES.maxGuesses - 1; i++) {
      log(`take ${i + 1}: ${wrong[i]!.title}`);
      await guessViaUi(page, wrong[i]!);
      const slot = hintTakes.get(i + 1);
      if (slot) {
        await page.getByText('Unlocked').first().waitFor({ timeout: 15_000 }).catch(() => {});
        const picked = await revealNote(page, slot);
        log(`note ${slot}: ${picked ?? 'none available'}`);
      }
      if (i === 3) {
        // Mid-round reload: resume HTML + /api/play.
        await page.reload();
        visited.push('/ (reload)');
        await page.getByRole('combobox', { name: /Name a film/i }).waitFor({ timeout: 30_000 });
      }
    }

    // 3. Other pages, client navigations (RSC payloads) and APIs while the round is still open.
    for (const name of ['Vault', 'Leaderboard']) {
      const link = page.getByRole('navigation').getByRole('link', { name, exact: false }).first();
      if (await link.count()) {
        await link.click();
        await page.waitForLoadState('networkidle').catch(() => {});
        visited.push(`nav:${name}`);
      }
    }
    for (const path of ['/vault', '/stats', '/leaderboard', '/how-to-play', '/pitch', '/settings', '/modes', '/admin']) {
      await page.goto(path);
      visited.push(path);
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    const today = (await (await page.request.get('/api/today')).json()) as { number: number };
    const ref = String(today.number);
    const apiPaths = [
      '/api/today',
      `/api/play?kind=daily&ref=${ref}`,
      `/api/hint/options?kind=daily&ref=${ref}`,
      `/api/stats/daily/${ref}`,
      '/api/leaderboard?period=week&noNotes=false',
      '/api/me',
      `/${ref}`,
    ];
    for (const p of apiPaths) {
      await page.goto(p).catch(() => {}); // through the page so the response listener records it
      visited.push(p);
    }
    for (const raw of metaImages) {
      if (!raw) continue;
      const u = new URL(raw);
      const local = `${baseURL.replace(/\/$/, '')}${u.pathname}${u.search}`;
      await page.goto(local).catch(() => {});
      visited.push(`meta image ${u.pathname}`);
    }

    // Back to the game for the final move; check cookies first.
    await page.goto('/');
    await page.getByRole('combobox', { name: /Name a film/i }).waitFor({ timeout: 30_000 });
    await settle();

    const documentCookie = await page.evaluate(() => document.cookie);
    const cookies = await context.cookies();
    const glPlays = cookies.find((c) => c.name === 'gl_plays');
    const cookieFindings: LeakFinding[] = [];
    if (findTitle(documentCookie, needles) || new RegExp(`(?<![\\w-])${answer.id}(?![\\w-])`).test(documentCookie)) {
      cookieFindings.push({ source: 'document.cookie', kind: 'id', detail: documentCookie.slice(0, 200) });
    }
    for (const c of cookies) {
      const decoded = c.name === 'gl_plays' ? decodeSignedCookie(c.value) : null;
      const text = decoded ?? decodeURIComponent(c.value);
      if (findTitle(text, needles)) cookieFindings.push({ source: `cookie ${c.name}`, kind: 'title', detail: text.slice(0, 200) });
      if (decoded) {
        try {
          const hit = findIdInJson(JSON.parse(decoded), answer.id);
          if (hit) cookieFindings.push({ source: `cookie ${c.name}`, kind: 'id', detail: hit });
        } catch {
          /* not JSON */
        }
      }
    }

    // 4. Final move: take 10 is the answer. Only from here may it appear.
    log(`take ${RULES.maxGuesses}: the answer`);
    const finalInput = page.getByRole('combobox', { name: /Name a film/i });
    await finalInput.click();
    await finalInput.fill(answer.title);
    const option = page.getByRole('option').filter({ hasText: answer.title }).filter({ hasText: String(answer.releaseYear) }).first();
    await option.waitFor({ state: 'visible', timeout: 15_000 });
    await settle(); // everything so far is "before"
    phase = 'after';
    await option.click();
    await page.getByText('GREENLIT', { exact: true }).first().waitFor({ timeout: 15_000 });
    await settle();

    // Static chunks are immutable: re-download any whose body the browser never delivered.
    for (const r of responses) {
      if (!r.unreadable || !r.url.includes('/_next/static/')) continue;
      const again = await context.request.get(r.url).catch(() => null);
      if (!again?.ok()) continue;
      r.body = await again.text();
      r.bytes = r.body.length;
      r.unreadable = false;
    }

    // 5. Scan.
    const findings: LeakFinding[] = [...cookieFindings];
    const revealFindings: LeakFinding[] = [];
    for (const r of responses) {
      if (isExcluded(r.url)) continue;
      const isHint = /\/api\/hint(\?|$)/.test(r.url) && !r.url.includes('/options');
      const f = scanCaptured({ url: r.url, contentType: r.contentType, body: r.body }, needles, { skipTagline: isHint });
      if (r.phase === 'before') findings.push(...f);
      else revealFindings.push(...f);
      if (r.body && /javascript/.test(r.contentType)) {
        const lib = findLibraryInChunk(r.body, library);
        if (lib) findings.push({ source: r.url, kind: 'library', detail: lib });
      }
    }

    const kind = (r: CapturedResponse) =>
      r.resourceType === 'script' || /javascript/.test(r.contentType)
        ? 'js'
        : /css/.test(r.contentType)
          ? 'css'
          : /x-component/.test(r.contentType) || r.url.includes('_rsc=')
            ? 'rsc'
            : /html/.test(r.contentType)
              ? 'html'
              : /json/.test(r.contentType)
                ? 'json'
                : /image/.test(r.contentType)
                  ? 'images'
                  : 'other';
    const counts = { before: 0, after: 0, js: 0, css: 0, html: 0, rsc: 0, json: 0, images: 0, unreadable: 0 };
    for (const r of responses) {
      counts[r.phase]++;
      if (r.unreadable) counts.unreadable++;
      const k = kind(r);
      if (k !== 'other') counts[k]++;
    }

    return {
      answer: { id: answer.id, title: answer.title },
      responses,
      findings,
      revealFindings,
      visited,
      cookieChecks: { glPlaysHttpOnly: glPlays ? glPlays.httpOnly : null, documentCookie },
      counts,
    };
  } finally {
    await context.close();
  }
}
