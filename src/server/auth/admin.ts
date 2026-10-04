// Admin check (WS7): an email listed in the comma-separated ADMIN_EMAILS env, case-insensitive.
import 'server-only';

export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined, raw: string | undefined = process.env.ADMIN_EMAILS): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).includes(email.trim().toLowerCase());
}
