// Client settings (Section 3 /settings, 6.6, 6.7, 9.1 item 11). Persists `ClientSettings` in
// localStorage under STORAGE_KEYS.settings and mirrors the visual ones onto <html>:
//   data-colorblind="true"            swaps the status palette and adds patterns (tokens.css)
//   data-reduced-motion="on" | "off"  forces motion off / on; absent means follow the OS
// Every storage access is wrapped in try/catch: private windows and blocked storage must not
// break the page. A small external store keeps every hook in sync, across tabs too.
import { useCallback, useSyncExternalStore } from 'react';
import { STORAGE_KEYS } from '@/config/game';
import { REGION_CODES } from '@/config/regions';
import type { ClientSettings, RegionCode } from '@/lib/types';

export const DEFAULT_SETTINGS: ClientSettings = Object.freeze({
  region: null,
  colorblind: false,
  reducedMotion: 'system',
}) as ClientSettings;

const MOTION_VALUES = ['system', 'on', 'off'] as const;

/** Coerce anything (parsed JSON, partial objects) into a valid ClientSettings. */
export function normalizeSettings(input: unknown): ClientSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_SETTINGS };
  const o = input as Record<string, unknown>;
  const region =
    typeof o.region === 'string' && (REGION_CODES as readonly string[]).includes(o.region)
      ? (o.region as RegionCode)
      : null;
  const colorblind = o.colorblind === true;
  const reducedMotion = (MOTION_VALUES as readonly unknown[]).includes(o.reducedMotion)
    ? (o.reducedMotion as ClientSettings['reducedMotion'])
    : 'system';
  return { region, colorblind, reducedMotion };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.settings);
  } catch {
    return null;
  }
}

/** Read settings from localStorage. Never throws; falls back to defaults. */
export function readSettings(): ClientSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  const raw = readRaw();
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// ---- external store ---------------------------------------------------------------------

const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedValue: ClientSettings = DEFAULT_SETTINGS;

function snapshot(): ClientSettings {
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = readSettings();
  }
  return cachedValue;
}

function emit() {
  for (const l of listeners) l();
}

function onStorage(e: StorageEvent) {
  if (e.key === null || e.key === STORAGE_KEYS.settings) emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

const serverSnapshot = () => DEFAULT_SETTINGS;

/** Merge a patch into stored settings, persist, apply to <html>, notify hooks. */
export function writeSettings(patch: Partial<ClientSettings>): ClientSettings {
  const next = normalizeSettings({ ...readSettings(), ...patch });
  try {
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
  } catch {
    // Storage blocked: keep the in-memory value for this page view.
    cachedRaw = JSON.stringify(next);
    cachedValue = next;
  }
  applySettingsToDocument(next);
  emit();
  return next;
}

/** Stamp the visual settings onto <html> (or a given root, for tests). */
export function applySettingsToDocument(
  settings: ClientSettings,
  root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null,
): void {
  if (!root) return;
  if (settings.colorblind) root.setAttribute('data-colorblind', 'true');
  else root.removeAttribute('data-colorblind');
  if (settings.reducedMotion === 'system') root.removeAttribute('data-reduced-motion');
  else root.setAttribute('data-reduced-motion', settings.reducedMotion);
}

export { SETTINGS_BOOT_SCRIPT } from '@/components/chrome/settings-boot';

/** React hook: current settings plus an updater. Server render sees DEFAULT_SETTINGS. */
export function useSettings(): [ClientSettings, (patch: Partial<ClientSettings>) => void] {
  const settings = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const update = useCallback((patch: Partial<ClientSettings>) => {
    writeSettings(patch);
  }, []);
  return [settings, update];
}

// ---- reduced motion ---------------------------------------------------------------------

const RM_QUERY = '(prefers-reduced-motion: reduce)';

function systemPrefersReduced(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(RM_QUERY).matches;
  } catch {
    return false;
  }
}

function subscribeMedia(listener: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  let mq: MediaQueryList;
  try {
    mq = window.matchMedia(RM_QUERY);
  } catch {
    return () => {};
  }
  mq.addEventListener?.('change', listener);
  return () => mq.removeEventListener?.('change', listener);
}

/** Resolve the effective preference from a setting and the OS preference. Pure. */
export function resolveReducedMotion(setting: ClientSettings['reducedMotion'], system: boolean): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  return system;
}

/** True when motion should be reduced. Honors settings.reducedMotion 'system' | 'on' | 'off'.
 *  Server render returns true (no motion until we know), so nothing animates pre-hydration. */
export function usePrefersReducedMotion(): boolean {
  const [settings] = useSettings();
  const system = useSyncExternalStore(subscribeMedia, systemPrefersReduced, () => true);
  return resolveReducedMotion(settings.reducedMotion, system);
}

/** Non-hook check, for event handlers and effects. */
export function prefersReducedMotionNow(): boolean {
  return resolveReducedMotion(readSettings().reducedMotion, systemPrefersReduced());
}

/** Test helper: drop cached snapshot so a fresh localStorage value is re-read. */
export function __resetSettingsCacheForTests(): void {
  cachedRaw = undefined;
  cachedValue = DEFAULT_SETTINGS;
}
