// Browser side effects for the ShareSheet (WS6). Kept apart from the component so they are easy
// to test and reuse (e.g. by extra modes).

/** True when the native share sheet should be preferred: Web Share API on a touch-first device. */
export function canUseNativeShare(nav: Navigator | undefined = globalThis.navigator): boolean {
  if (!nav || typeof nav.share !== 'function') return false;
  const uaMobile = (nav as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  if (uaMobile === true) return true;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(pointer: coarse)').matches;
  }
  return false;
}

export type NativeShareResult = 'shared' | 'cancelled' | 'failed';

/** navigator.share with text + url. A user cancel (AbortError) is not a failure. */
export async function nativeShare(data: { text: string; url: string; title?: string }): Promise<NativeShareResult> {
  try {
    await navigator.share(data);
    return 'shared';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    return 'failed';
  }
}

/** Copy text: async Clipboard API first, then a hidden textarea + execCommand fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Permission denied or insecure context: fall through to the legacy path.
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement as HTMLElement | null;
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '-9999px';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = typeof document.execCommand === 'function' && document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  active?.focus?.();
  return ok;
}

/** Fetch an image URL and save it through a temporary anchor download. */
export async function downloadImage(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image request failed (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    // Give the browser a beat to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}

/** X (Twitter) web intent for a prefilled post. */
export function xIntentUrl(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}
