'use client';
import { useEffect, type ReactNode } from 'react';
import { applySettingsToDocument, readSettings, useSettings } from '@/lib/settings';

/**
 * Keeps <html> in sync with client settings (colorblind palette, reduced motion override).
 * The inline SETTINGS_BOOT_SCRIPT in the root layout applies them before first paint; this
 * keeps them right after changes in this tab or another one.
 */
export function SettingsProvider({ children }: { children?: ReactNode }) {
  const [settings] = useSettings();
  useEffect(() => {
    // Read storage directly: during hydration the hook still reports the server defaults.
    applySettingsToDocument(readSettings());
  }, [settings]);
  return <>{children}</>;
}
