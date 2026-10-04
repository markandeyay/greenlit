// Handle rules (WS7). Pure and client-safe: the settings form and the server share them.
// Matches the profiles.handle check constraint: ^[A-Za-z0-9_]{3,20}$ (supabase migration).
import { APP_NAME } from '@/config/brand';

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;
export const HANDLE_PATTERN = /^[A-Za-z0-9_]+$/;

/** Names that would impersonate the game or staff. Compared case-insensitively. */
const RESERVED = new Set(
  ['admin', 'administrator', 'moderator', 'mod', 'staff', 'support', 'official', 'root', 'system', 'null', 'undefined', APP_NAME]
    .map((s) => s.toLowerCase()),
);

export type HandleCheck = { ok: true; handle: string } | { ok: false; message: string };

/** Validate a handle and return the trimmed value, or a friendly error message. */
export function validateHandle(input: unknown): HandleCheck {
  if (typeof input !== 'string') return { ok: false, message: 'Pick a handle for the credits.' };
  const handle = input.trim();
  if (handle.length === 0) return { ok: false, message: 'Pick a handle for the credits.' };
  if (handle.length < HANDLE_MIN) return { ok: false, message: `Too short. Use at least ${HANDLE_MIN} characters.` };
  if (handle.length > HANDLE_MAX) return { ok: false, message: `Too long. Keep it to ${HANDLE_MAX} characters or fewer.` };
  if (!HANDLE_PATTERN.test(handle)) {
    return { ok: false, message: 'Letters, numbers and underscores only. No spaces.' };
  }
  if (RESERVED.has(handle.toLowerCase())) return { ok: false, message: 'That name is reserved. Try another.' };
  return { ok: true, handle };
}

/** How a player appears on boards. Players without a handle are billed as an "Extra". */
export function boardName(profile: { id: string; handle: string | null }): string {
  if (profile.handle) return profile.handle;
  const tag = profile.id.replace(/[^0-9a-f]/gi, '').slice(0, 4).toUpperCase() || '0000';
  return `Extra #${tag}`;
}
