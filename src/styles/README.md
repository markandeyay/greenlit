# Design system (WS4)

The look is a projection booth: black stock, cream print, slates, timecode and leader. It is
ported from the UNC Student Film Association site (`sfawebsite/app/styles/*`, `app/layout.tsx`,
`components/engine/Chrome.tsx`, `components/lot/*`, `lib/fx/loader.ts`) and refitted for a dark,
single-surface game. Live reference of every component and state: **`/dev/kitchen-sink`**.

## Files

| File | What it holds |
|---|---|
| `tokens.css` | All tokens. The WS0 contract names (`--bg` ... `--red-rec`) plus additive type, space, film, motion and depth tokens. `[data-colorblind="true"]` swaps the status palette. |
| `globals.css` | Tailwind import, `@theme inline` mappings, base document styles, type primitives (`ty-*`), utilities (`perfs`, `tabular`, `sr-only-focusable`), shared keyframes and `anim-*` classes, the reduced-motion contract. |
| `ui.css` | Primitive classes (`gl-btn`, `gl-chip`, `gl-tag`, `gl-panel`, `gl-dialog`, `gl-tabs`, `gl-switch`, `gl-toast`, `gl-cell`, `gl-status`). The ONLY place status colors are painted. |
| `film.css` | Chrome and motifs: skip link, head/tail leader strips, nav, mobile menu, timecode, scene heading, slate meta, breadcrumb, credit roll, footer, grain, the countdown leader, the call-sheet table. (Named `film.css`: a stylesheet called `chrome.css` could not be resolved by Tailwind's importer in this environment.) |

## Tokens, from the SFA source

| Token | Value | SFA origin |
|---|---|---|
| `--bg` | `#0e0d0c` | `--ink` (the screening-room dark) |
| `--ink` | `#f5f2eb` | `--paper` (script paper) |
| `--surface` / `--surface-2` | `#171513` / `#221f1c` | ink lifted in two steps |
| `--ink-dim` | `#a8a196` | `rgba(245,242,235,.62)` on ink, flattened (7.6:1) |
| `--rule` | `#36332f` | `--ink-hair` / 16% paper on ink, flattened |
| `--red-rec` | `#f04a42` | `--rec #E0261F`, lifted from 4.1:1 to 5.3:1 so it passes AA as text |
| `--green`, `--amber`, `--miss` | doc 6.2 values | status only; SFA has no equivalent |

Spacing `--s1..--s10` (4px base), type scale `--t-mega..--t-micro`, tracking `--tr-*`, leading
`--lh-*`, eases `--e-out / --e-inout / --e-soft / --e-snap` and durations `--d1..--d5` are the SFA
values (type compressed one tier). `--stagger: 80ms` is the cell-flip stagger. `--margin` is 16px
at 375px. `npm test` checks AA contrast of every text pair in both palettes against this file.

**Status colors are reserved.** `--green` = match, `--amber` = close (numeric only), `--miss` = no
match, `--red-rec` = the REC dot and loss-state accents. Never use them for decoration, links,
focus rings or buttons. Use `StatusCell`, `Chip status=...` or `.gl-status[data-verdict]`.

## Fonts (next/font, three families, set on `<html>` in `src/app/layout.tsx`)

| Role | Family | Variable | Tailwind |
|---|---|---|---|
| Display: every title, uppercase, 900 | Big Shoulders (variable, opsz) | `--font-display` | `font-display` |
| Accent: one italic word in a heading | Instrument Serif italic | `--font-serif` | `font-serif` |
| Script: timecode, slate fields, labels, numbers in cells | Courier Prime 400/700 | `--font-mono` | `font-mono` |
| Body | system grotesk (Helvetica Neue / Arial), as on SFA | `--font-body` | `font-sans` |

Courier Prime at label size is always 700 (SFA rule). Numbers use `tabular-nums` (`ty-num`).

## Motifs (all in `src/components/chrome`)

- `SceneHeading` script-page head: `01  INT. THE CALL SHEET - NIGHT  01`, parenthetical, display title with accent (`title="The *Call Sheet*"`). The heading element holds only the title.
- `SlateMeta` `Roll 2026 · Reel 212 · Sc 01 · Tk 04` above major sections.
- `Breadcrumb` edge print with chevrons: `APP ▸ 2026 ▸ 212A` (`reelCode(212)` gives `212A`).
- `FilmMicrocopy` decorative `24 fps · 2.39 : 1`. `RecDot` the blinking REC light.
- `LeaderStrip kind="head" | "tail"` perforated edge-print strips (top of page, footer).
- `EndCredits` credit roll (role right, name left). `Footer` is THE END bracketed by tail leader with TMDB attribution.
- `TimecodeClock` countdown to the next reset as `TC HH:MM:SS:FF` (24 fps); placeholder until mounted; `role="timer"` with a minute-level label.
- `Leader` Academy countdown 8 to 2, about 1.2s, first visit per New York day, skippable, aria-hidden, off under reduced motion. `replayLeader()` replays it.
- `Grain` fixed SVG-noise grain plus vignette, pointer-events none.

## Primitives (`src/components/ui`, import from `@/components/ui`)

`Button` / `ButtonLink` (`variant="slate"` is the clapperboard primary CTA; `solid`, `outline`,
`ghost`, `danger`), `IconButton` / `IconLink` (label required), `Chip` / `ToggleChip`, `Tag`
(`LEAD`, `SUPP`, `US`), `Panel` (`variant="sheet"` for call-sheet ruling) / `Card`, `Dialog` /
`ConfirmDialog` (focus trap, Escape, focus return, scroll lock), `Tabs` (roving tabindex),
`Switch` / `Toggle`, `Spinner`, `ToastProvider` + `useToast()` (mounted in the root layout),
`Accent` / `ItalicAccent` / `AccentText` / `DisplayHeading`, `VisuallyHidden`, `StatusGlyph`,
`StatusCell`, and helpers `directionWord`, `cellAriaLabel`, `verdictWords`, `statusGlyph`.

### Guidance for WS5 and others

- Pages render their own `<main>`; the layout wraps children in `#content` (skip-link target) between `Nav` and `Footer`.
- Build guess cells on `StatusCell` (or `.gl-cell[data-verdict]`): it gives the fill, the ✓ / ≈ glyph, colorblind patterns and an aria-label like "Year 2006, close, answer is later." Use `directionWord('year', dir, verdict)` for LATER / EARLIER etc. Empty cast slots: `verdict="empty"`.
- Flip-in: `animate index={i}` on `StatusCell`, or class `anim-flip` with `--i`. Win stamp: `anim-stamp`. Loss card flicker: `anim-flicker`. All are neutralised by the reduced-motion contract.
- Need motion decisions in JS? `usePrefersReducedMotion()` from `@/lib/settings` (honors the Settings override). Settings UI (WS7): `useSettings()` returns `[settings, update]`; `update({ colorblind: true })` persists and restamps `<html>`.
- Headings: `ty-display` + `Accent` for one italic word. Labels: `ty-label`. Numbers: `ty-num`.
- No component in this folder ever receives or renders puzzle answers.
