// @vitest-environment jsdom
// /admin server page gate: non-admins get the sign-in screen and no console; admins get the console.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SessionUser } from '@/server/auth';

const auth = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock('@/server/auth', () => ({ getCurrentUser: async () => auth.user }));
vi.mock('@/components/admin/AdminConsole', () => ({ AdminConsole: () => <div data-testid="console">console</div> }));

import AdminPage from '@/app/admin/page';
import PitchPage from '@/app/pitch/page';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('/admin', () => {
  it('shows a polite sign-in screen to non-admins (no console, no data)', async () => {
    auth.user = { id: 'u', email: 'p@example.com', isAdmin: false };
    render(await AdminPage());
    expect(screen.getByText(/sign in with an admin account/i)).toBeInTheDocument();
    expect(screen.queryByTestId('console')).toBeNull();
  });

  it('renders the console for admins', async () => {
    auth.user = { id: 'a', email: 'boss@example.com', isAdmin: true };
    render(await AdminPage());
    expect(screen.getByTestId('console')).toBeInTheDocument();
    expect(screen.queryByText(/Development mode/)).toBeNull();
  });

  it('opens in development with a clear notice', async () => {
    auth.user = null;
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('ADMIN_DEV_OPEN', '1');
    render(await AdminPage());
    expect(screen.getByTestId('console')).toBeInTheDocument();
    expect(screen.getByText(/Development mode/)).toBeInTheDocument();
  });
});

describe('/pitch', () => {
  it('renders the film-set heading and the create form', () => {
    render(<PitchPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Pitch a film/i);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create challenge/i })).toBeDisabled();
  });
});
