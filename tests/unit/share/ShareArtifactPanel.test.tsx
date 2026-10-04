// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/ui';
import { ShareArtifactPanel } from '@/components/share';
import type { ShareArtifact } from '@/components/share/artifact';
import { artifactImageUrl, buildArtifact } from '@/components/share/artifactCodec';
import { artifactFileName, shareBodyFromText } from '@/components/share/ShareArtifactPanel';
import { xIntentUrl } from '@/components/share/shareActions';

const artifact: ShareArtifact = buildArtifact({
  mode: 'release_order',
  date: '2026-10-04',
  outcome: 'won',
  stat: '2/3',
  statCaption: 'attempts',
  grid: [
    ['match', 'miss', 'miss', 'close', 'match'],
    ['match', 'match', 'match', 'match', 'match'],
  ],
  url: 'https://greenlit.test/modes/release-order',
  text: 'Release Order · 2/3\n🟩⬛⬛🟨🟩\n🟩🟩🟩🟩🟩\ngreenlit.test/modes/release-order',
});
const body = 'Release Order · 2/3\n🟩⬛⬛🟨🟩\n🟩🟩🟩🟩🟩';

function setup(a: ShareArtifact = artifact) {
  return render(
    <ToastProvider>
      <ShareArtifactPanel artifact={a} heading="Share your run" />
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
const pngResponse = () => new Response(new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }));

beforeEach(() => {
  stubMatchMedia(false);
  delete nav.share;
  delete nav.canShare;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const click = async (name: string) => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
};

describe('ShareArtifactPanel', () => {
  it('previews the actual card PNG with a skeleton until it loads', () => {
    setup();
    const img = screen.getByTestId('share-card-image') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe(artifactImageUrl(artifact, 'portrait'));
    expect(img).toHaveAttribute('width', '1080');
    expect(img).toHaveAttribute('height', '1350');
    expect(img.getAttribute('alt')).toMatch(/Release Order/);
    expect(screen.getByTestId('share-card-skeleton')).toBeInTheDocument();
    fireEvent.load(img);
    expect(screen.queryByTestId('share-card-skeleton')).toBeNull();
  });

  it('shows a fallback when the card fails to load', () => {
    setup();
    fireEvent.error(screen.getByTestId('share-card-image'));
    expect(screen.getByText(/Card preview unavailable/)).toBeInTheDocument();
  });

  it('switches between Card and Text tabs by click and keyboard', () => {
    setup();
    const cardTab = screen.getByRole('tab', { name: 'Card' });
    const textTab = screen.getByRole('tab', { name: 'Text' });
    expect(cardTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('share-preview').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
    fireEvent.click(textTab);
    expect(textTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('share-preview').textContent).toBe(artifact.text);
    expect(screen.getByTestId('share-preview').closest('[role="tabpanel"]')).not.toHaveAttribute('hidden');
    fireEvent.keyDown(textTab, { key: 'ArrowLeft' });
    expect(cardTab).toHaveAttribute('aria-selected', 'true');
    expect(document.activeElement).toBe(cardTab);
  });

  it('has labelled actions and an X intent with the share text', () => {
    setup();
    expect(screen.getByRole('region', { name: 'Share your run' })).toBeInTheDocument();
    for (const name of ['Share', 'Copy text', 'Download image']) expect(screen.getByRole('button', { name })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Post to X/ })).toHaveAttribute('href', xIntentUrl(artifact.text));
  });

  it('copies the text and toasts "Copied" on desktop', async () => {
    setup();
    await click('Share');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(artifact.text);
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('shares the PNG file with text and url when canShare({ files }) allows it', async () => {
    stubMatchMedia(true);
    const share = vi.fn().mockResolvedValue(undefined);
    nav.share = share;
    nav.canShare = vi.fn((d: ShareData) => Array.isArray(d.files) && d.files.length === 1);
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(pngResponse()));
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await click('Share');
    expect(fetchMock).toHaveBeenCalledWith(artifactImageUrl(artifact, 'portrait'));
    expect(share).toHaveBeenCalledTimes(1);
    const data = share.mock.calls[0]![0] as ShareData;
    expect(data.text).toBe(body);
    expect(data.url).toBe(artifact.url);
    expect(data.files).toHaveLength(1);
    const file = data.files![0]!;
    expect(file.type).toBe('image/png');
    expect(file.name).toBe(artifactFileName(artifact));
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
  });

  it('prefetches the file after the preview loads on share-capable devices', async () => {
    stubMatchMedia(true);
    nav.share = vi.fn().mockResolvedValue(undefined);
    nav.canShare = () => true;
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(pngResponse()));
    vi.stubGlobal('fetch', fetchMock);
    setup();
    await act(async () => {
      fireEvent.load(screen.getByTestId('share-card-image'));
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await click('Share');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((nav.share as ReturnType<typeof vi.fn>).mock.calls[0]![0].files).toHaveLength(1);
  });

  it('shares text and url only when files are not shareable', async () => {
    stubMatchMedia(true);
    const share = vi.fn().mockResolvedValue(undefined);
    nav.share = share;
    nav.canShare = () => false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(pngResponse())));
    setup();
    await click('Share');
    expect(share).toHaveBeenCalledWith({ text: body, url: artifact.url });
  });

  it('does nothing more on cancel, and copies when native share fails', async () => {
    stubMatchMedia(true);
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(pngResponse())));
    nav.share = vi.fn().mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    setup();
    await click('Share');
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    cleanup();
    nav.share = vi.fn().mockRejectedValue(new TypeError('nope'));
    setup();
    await click('Share');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(artifact.text);
  });

  it('downloads the card PNG', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(pngResponse()));
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    setup();
    await click('Download image');
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(artifactImageUrl(artifact, 'portrait'));
    const name = (clickSpy.mock.instances[0] as unknown as HTMLAnchorElement).download;
    expect(name).toBe(artifactFileName(artifact));
    expect(name).toMatch(/-release-order-2026-10-04.png$/);
  });
});

describe('panel helpers', () => {
  it('shareBodyFromText strips only a trailing link line', () => {
    expect(shareBodyFromText(artifact.text, artifact.url)).toBe(body);
    expect(shareBodyFromText('a\nb', 'https://x.test/')).toBe('a\nb');
    expect(shareBodyFromText('a\nx.test/1\n', 'https://x.test/1')).toBe('a');
  });
});
