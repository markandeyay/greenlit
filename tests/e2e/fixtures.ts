// Shared Playwright fixtures for the Greenlit e2e suite.
// - Marks the Leader intro as already seen today (New York date), so it never blocks a test.
// - Gives every test its own pseudo client IP (x-forwarded-for) so the per-IP guess rate limit
//   (RATE_LIMITS.guessPerMinutePerIp) is not shared across the whole suite running on localhost.
import { test as base, expect } from '@playwright/test';
import { STORAGE_KEYS } from '../../src/config/game';

let ipCounter = 0;
function pseudoIp(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  ipCounter++;
  return `10.${(h >>> 16) & 255}.${(h >>> 8) & 255}.${(h + ipCounter) & 255}`;
}

export const LEADER_INIT = (key: string) => {
  try {
    const d = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    window.localStorage.setItem(key, d);
  } catch {
    /* storage blocked: the leader is skippable anyway */
  }
};

export const test = base.extend({
  extraHTTPHeaders: async ({}, provide, testInfo) => {
    await provide({ 'x-forwarded-for': pseudoIp(`${testInfo.project.name}:${testInfo.titlePath.join('/')}:${testInfo.retry}`) });
  },
  context: async ({ context }, provide) => {
    await context.addInitScript(LEADER_INIT, STORAGE_KEYS.leaderSeen);
    await provide(context);
  },
});

export { expect };
