// Server-only: the film-grain texture (public/og/grain.png) as a data URI, read once per server
// instance. Shared by every ImageResponse renderer.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

let grainPromise: Promise<string | null> | null = null;

export function loadGrain(): Promise<string | null> {
  grainPromise ??= readFile(join(process.cwd(), 'public/og/grain.png'), 'base64')
    .then((b64) => `data:image/png;base64,${b64}`)
    .catch(() => null);
  return grainPromise;
}
