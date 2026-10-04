// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { ShareSheet } from '@/components/share';
import { buildShareBody, buildShareText, shareUrl } from '@/components/share/shareText';
import { artifactImageUrl } from '@/components/share/artifactCodec';
import { classicArtifact } from '@/components/share/classicArtifact';
import { canUseNativeShare, copyText, xIntentUrl } from '@/components/share/shareActions';
import { SECRET_FILM_ID, SECRET_TITLE, specExample } from './fixtures';

const input = specExample({ hintsUsed: 1 });

function setup() {
  return render(
    <ToastProvider>
      <ShareSheet {...input} />
    </ToastProvider>,
  );
}

function stubMatchMedia(coarse: boolean) {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: coarse && q.includes('coarse'),
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

const nav = navigator as unknown as Record<string, unknown>;

beforeEach(() => {
  stubMatchMedia(false);
  delete nav.share;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ShareSheet', () => {
  it('shows the card and the exact share text as a preview, and no answer data', () => {
    const { container } = setup();
    expect(screen.getByTestId('share-preview').textContent).toBe(buildShareText(input));
    expect(screen.getByTestId('share-card-image').getAttribute('src')).toBe(artifactImageUrl(classicArtifact(input), 'portrait'));
    expect(container.querySelector('[data-share-sheet]')).not.toBeNull();
    expect(container.innerHTML).not.toContain(SECRET_TITLE);
    expect(container.innerHTML).not.toContain(String(SECRET_FILM_ID));
  });

  it('has clearly labelled controls', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Post your take' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Card' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Download image' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
    const x = screen.getByRole('link', { name: /Post to X/ });
    expect(x).toHaveAttribute('href', xIntentUrl(buildShareText(input)));
    expect(x.getAttribute('href')).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?text=/);
    expect(x).toHaveAttribute('target', '_blank');
    expect(x).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('copies to the clipboard on desktop and toasts "Copied"', async () => {
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(buildShareText(input));
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('uses the Web Share API on mobile with text and url', async () => {
    stubMatchMedia(true);
    const share = vi.fn().mockResolvedValue(undefined);
    nav.share = share;
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });
    expect(share).toHaveBeenCalledWith({ text: buildShareBody(input), url: shareUrl(input) });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('does nothing more when the user cancels the share sheet', async () => {
    stubMatchMedia(true);
    nav.share = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('falls back to copying when native share fails', async () => {
    stubMatchMedia(true);
    nav.share = vi.fn().mockRejectedValue(new TypeError('nope'));
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('downloads the verdict-only image as a PNG', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Blob(['png'], { type: 'image/png' })));
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    });
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(artifactImageUrl(classicArtifact(input), 'portrait'));
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toMatch(/reel-212\.png$/);
    vi.unstubAllGlobals();
  });

  it('toasts when the image download fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad', { status: 400 })));
    setup();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    });
    expect(await screen.findByText(/Could not download/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('shareActions', () => {
  it('copyText falls back to execCommand when the Clipboard API is missing or throws', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: unknown }).execCommand = exec;
    expect(await copyText('hello')).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();

    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    exec.mockReturnValue(false);
    expect(await copyText('hello')).toBe(false);
  });

  it('canUseNativeShare needs navigator.share and a touch-first device', () => {
    expect(canUseNativeShare({} as Navigator)).toBe(false);
    stubMatchMedia(false);
    expect(canUseNativeShare({ share: () => Promise.resolve() } as unknown as Navigator)).toBe(false);
    stubMatchMedia(true);
    expect(canUseNativeShare({ share: () => Promise.resolve() } as unknown as Navigator)).toBe(true);
    stubMatchMedia(false);
    expect(
      canUseNativeShare({ share: () => Promise.resolve(), userAgentData: { mobile: true } } as unknown as Navigator),
    ).toBe(true);
  });
});
