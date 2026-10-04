// Screenshot helper for visual review. Usage:
//   node scripts/qa/shoot.mjs <outDir> [baseUrl=http://localhost:3200] [paths...]
// Captures each path at 390x844 (full page) and 1440x900, skips the Leader intro, reduced motion on,
// and prints any image that failed to load. View the PNGs with an image viewer (or the Read tool).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [outDir = 'shots', base = 'http://localhost:3200', ...rest] = process.argv.slice(2);
const paths = rest.length ? rest : ['/'];
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
for (const [label, viewport, full] of [['m390', { width: 390, height: 844 }, true], ['d1440', { width: 1440, height: 900 }, false]]) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('gl_leader', new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()));
    } catch {}
  });
  const page = await ctx.newPage();
  for (const p of paths) {
    await page.goto(base + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const name = (p === '/' ? 'home' : p.replace(/[/?=&]+/g, '_').replace(/^_/, '')) || 'home';
    await page.screenshot({ path: `${outDir}/${label}-${name}.png`, fullPage: full });
    const broken = await page.$$eval('img', (els) => els.filter((e) => e.complete && e.naturalWidth === 0).map((e) => e.src));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (broken.length || overflow) console.log(`${label} ${p}: broken=${broken.length} overflowX=${overflow}`, broken.slice(0, 5));
  }
  await ctx.close();
}
await browser.close();
console.log('done', outDir);
