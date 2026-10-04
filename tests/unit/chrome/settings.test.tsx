// @vitest-environment jsdom
import { act, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/config/game';
import {
  DEFAULT_SETTINGS,
  SETTINGS_BOOT_SCRIPT,
  __resetSettingsCacheForTests,
  applySettingsToDocument,
  normalizeSettings,
  readSettings,
  resolveReducedMotion,
  usePrefersReducedMotion,
  useSettings,
  writeSettings,
} from '@/lib/settings';

afterEach(cleanup);

function mockMatchMedia(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('prefers-reduced-motion') ? reduce : false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  localStorage.clear();
  __resetSettingsCacheForTests();
  document.documentElement.removeAttribute('data-colorblind');
  document.documentElement.removeAttribute('data-reduced-motion');
  mockMatchMedia(false);
});
afterEach(() => vi.restoreAllMocks());

describe('settings storage', () => {
  it('returns defaults when empty or corrupt', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEYS.settings, '{not json');
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('normalizes bad fields', () => {
    expect(normalizeSettings({ region: 'XX', colorblind: 'yes', reducedMotion: 'maybe' })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ region: 'GB', colorblind: true, reducedMotion: 'on' })).toEqual({
      region: 'GB',
      colorblind: true,
      reducedMotion: 'on',
    });
  });

  it('writes, persists and stamps <html>', () => {
    writeSettings({ colorblind: true, reducedMotion: 'on' });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)!)).toMatchObject({ colorblind: true, reducedMotion: 'on' });
    expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('on');
    writeSettings({ colorblind: false, reducedMotion: 'system' });
    expect(document.documentElement.hasAttribute('data-colorblind')).toBe(false);
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
  });

  it('survives storage that throws', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => writeSettings({ colorblind: true })).not.toThrow();
    expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');
    get.mockRestore();
    set.mockRestore();
  });

  it('applySettingsToDocument accepts a custom root', () => {
    const el = document.createElement('div');
    applySettingsToDocument({ region: null, colorblind: true, reducedMotion: 'off' }, el);
    expect(el.dataset.colorblind).toBe('true');
    expect(el.dataset.reducedMotion).toBe('off');
  });

  it('boot script applies stored settings', () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ colorblind: true, reducedMotion: 'off' }));
    new Function(SETTINGS_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute('data-colorblind')).toBe('true');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('off');
  });
});

describe('reduced motion', () => {
  it('resolves settings against the system', () => {
    expect(resolveReducedMotion('system', true)).toBe(true);
    expect(resolveReducedMotion('system', false)).toBe(false);
    expect(resolveReducedMotion('on', false)).toBe(true);
    expect(resolveReducedMotion('off', true)).toBe(false);
  });

  function Probe() {
    const reduced = usePrefersReducedMotion();
    const [s, update] = useSettings();
    return (
      <div>
        <span data-testid="rm">{String(reduced)}</span>
        <span data-testid="cb">{String(s.colorblind)}</span>
        <button onClick={() => update({ reducedMotion: 'on', colorblind: true })}>go</button>
      </div>
    );
  }

  it('hook follows the system, then the setting', () => {
    mockMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId('rm').textContent).toBe('false');
    act(() => screen.getByText('go').click());
    expect(screen.getByTestId('rm').textContent).toBe('true');
    expect(screen.getByTestId('cb').textContent).toBe('true');
  });

  it('hook honors a system preference', () => {
    mockMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId('rm').textContent).toBe('true');
  });
});
