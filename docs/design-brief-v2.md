# Design brief v2: simple, mass-market, shareable

Owner feedback (2026-10-04): "Images in the poster mode are not rendering correctly. It looks too complicated. A lot of people are going to be playing it. I want people to be able to share an artifact like they do with Wordle or Strava. Ensure it looks good on mobile."

Audit findings (production, 390px):
- Every film shows a tiny initials square instead of a poster, which reads as broken (no TMDB key yet, so `posterPath` is null everywhere).
- Every page stacks decoration before content: head-leader strip, timecode, breadcrumb, "24 FPS 2.39:1", scene heading "INT. ... - NIGHT", a parenthetical, a giant title, then a ~900px "The END" credits footer. On a phone the game starts at y~400 and the page is 2,300px tall for one input.
- Too many labels in Courier caps; instructions are hard to scan.

## Principles
1. **Game first.** On mobile the primary input is above the fold with no scrolling: header (~56px), one compact title line, the input. Nothing decorative above the game.
2. **One primary action per screen**, visually dominant. Everything else is quiet.
3. **One film motif per screen, max.** Keep the paper theme, Big Shoulders display, and the clapper/slate as the signature. Drop breadcrumbs, FilmMicrocopy ("24 fps 2.39:1"), head/tail leader strips, scene-heading kickers and parentheticals on play screens. A scene heading may remain on content pages (How to play) only.
4. **Readable.** Body copy in the sans at 16px+, Courier caps only for tiny labels (and sparingly). Instructions in 1 to 2 short sentences; details behind a "How to play" link or first-visit sheet.
5. **Slim chrome.** Header: wordmark, primary nav (Today, Modes), icon buttons (help, stats, settings). Timecode only on >= 1024px. Footer: one or two lines (TMDB attribution required, links). No full-screen credits on every page; "The End" flourish can live on How to play or the result card.
6. **Mobile is the primary target** (390x844 and 375x667). Tap targets >= 44px, no horizontal scroll, safe-area insets, sticky bottom actions where natural, no hover-only affordances.
7. **Posters look intentional.** Until real TMDB posters exist, every film gets a designed poster card (full 2:3 art, not a tiny chip) generated deterministically from its data. When `posterPath` is present, use the real TMDB image with the designed card as the loading/error fallback (never a broken image).
8. **The share artifact is a product.** Like Wordle (spoiler-free grid) and Strava (a beautiful stat card you post to stories). Every mode ends with a result card that is exactly what gets shared: a PNG (portrait 1080x1350 for feeds/stories, plus the existing 1200x630 link preview) and the emoji text. On mobile, "Share" uses the Web Share API with the image file when supported (navigator.canShare({ files })), else text plus a download. Spoiler-free always: never title, poster, cast, or the answer before the player finishes, and the shared image never contains the answer at all.
9. **Fast.** No new dependencies; images lazy; keep Lighthouse mobile >= 90.

## Unchanged
Spec rules (docs/greenlit-system-design.md) still win on game logic, the answer-secrecy rule, colors meaning one thing (green match, marker yellow close, gray miss, with glyphs), no em dashes, APP_NAME only, prefers-reduced-motion.
