// First-visit "How to play" sheet (design brief v2): shown once per browser, reopenable from the
// help button. Storage can be blocked (private mode, previews), so every access is guarded.

export const HOWTO_SEEN_KEY = 'gl_howto_seen';

export function howtoSeen(): boolean {
  try {
    return window.localStorage.getItem(HOWTO_SEEN_KEY) === '1';
  } catch {
    return true; // storage blocked: never nag on every visit
  }
}

export function markHowtoSeen(): void {
  try {
    window.localStorage.setItem(HOWTO_SEEN_KEY, '1');
  } catch {
    /* storage blocked: the sheet is reopenable anyway */
  }
}

/**
 * Should the sheet open by itself? Only on a first visit, and never under browser automation
 * (navigator.webdriver), so scripted QA runs are not blocked by a modal they did not ask for.
 */
export function shouldAutoOpenHowto(): boolean {
  try {
    if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  } catch {
    /* ignore */
  }
  return !howtoSeen();
}
