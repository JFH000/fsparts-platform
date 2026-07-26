# Landing Page Art Direction & GSAP Motion Redesign — Design

**Date:** 2026-07-25
**Status:** Approved (pending spec review)

## Goal

Redesign the visual identity and motion of `apps/shop/src/modules/landing/views/LandingView.vue` — the only true marketing surface in the fsparts-platform monorepo — to reach a level of typographic/visual craft and motion polish comparable to Stripe/Linear/Raycast, **without adopting their literal dev-tool visual language**. The result should read as premium and intentional for an HVAC/R industrial B2B distributor, not as a generic AI-generated SaaS landing page.

## Constraints discovered during brainstorming

1. **Stock Tailwind colors everywhere.** `brand` (blue-50…950) and `accent` (orange 400/500/600) in `packages/ui/src/tokens.css` are Tailwind's default blue/orange scales verbatim — instantly recognizable as unstyled defaults.
2. **The declared font never loads.** `--font-sans: 'Inter', system-ui, …` is set in `tokens.css`, but no `<link>`, `@font-face`, or `@fontsource` package exists anywhere in the repo. Every app silently falls back to `system-ui`.
3. **No heading/body font split, no dark-mode system, no custom spacing/shadow/radius tokens** anywhere in the platform — everything leans on stock Tailwind utilities.
4. **LandingView.vue is the only marketing surface.** Calculator and dashboard are utilitarian tools (wizards, tables, forms) with no hero/marketing content, so this redesign has no existing marketing visual language elsewhere in the platform to reconcile with.
5. **GSAP is not installed anywhere** in the monorepo (root or any workspace). No animation composables exist; the closest prior art is `LandingView.vue`'s own hand-rolled CSS `@keyframes` hero entrance + `IntersectionObserver`-based scroll-reveal + `requestAnimationFrame` count-up, and `ProductDetailView.vue`'s hand-rolled `<Transition>` slideshow fade — both already establish the `onMounted` (build) / `onUnmounted` (clean up) idiom this redesign should mirror.
6. **`@vueuse/core` (`^14.3.0`) is already a direct dependency of `apps/shop`**, though unused for animation today (ships `usePreferredReducedMotion`, `useIntersectionObserver`).

## Decisions (confirmed with user)

- **"Compete with Stripe/Linear/Raycast" means craft level, not visual language.** No dark-mode-SaaS/dev-tool cloning — a distinct visual identity translated for an industrial HVAC/R audience.
- **Scope: landing page only.** New palette and typography are defined as CSS custom properties scoped to `LandingView.vue`, not promoted to `packages/ui/tokens.css`. Catalog, calculator, dashboard, `AppHeader`, `AppFooter` are unchanged and keep the current `brand`/`accent`/Inter tokens.
- **Typography: three-tier system**, chosen live via the visual brainstorming companion over two alternatives (Fraunces+Inter+JetBrains Mono; Instrument Serif+Inter+IBM Plex Mono):
  - **Source Serif 4** (weight 600) — H1/H2 headings. Reads as authoritative/editorial without "fashion" flair.
  - **IBM Plex Sans** — body copy and UI text.
  - **IBM Plex Mono** — data accents: SKU/line codes, stat numbers, availability badge, uppercase labels. Reinforces the existing "spec sheet" motif already present in the current markup (`font-mono` on product line codes and stats).
  - Self-hosted via `@fontsource/source-serif-4`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` (not a Google Fonts `<link>`) — consistent with zero existing external font requests anywhere in the platform, and avoids a new third-party network dependency in production.
- **Palette: "Midnight & Ember"**, chosen live over two alternatives ("Ink & Amber", "Cobalt & Graphite"):
  | Token | Hex | Use |
  |---|---|---|
  | `--ink-950` | `#060B18` | Hero/section dark background |
  | `--ink-900` | `#0B1226` | Secondary dark surface (cards, calc banner) |
  | `--blue-500` | `#395FC4` | Primary interactive blue (links, focus) |
  | `--blue-300` | `#7C97D6` | Light accent text/strokes on dark backgrounds |
  | `--ember-500` | `#E85D3D` | Single high-saturation accent — primary CTA, used sparingly and deliberately (one-accent discipline, à la Linear/Raycast) |

  Defined as scoped custom properties on the landing page's root element (e.g. `.landing-page { --ink-950: #060B18; … }`), referenced via Tailwind v4 arbitrary-value syntax (`bg-[var(--ink-950)]`) — matching the codebase's existing convention of raw utility classes with no `@apply` abstraction layer.
- **Hero signature element: "Blueprint técnico."** Chosen live over two alternatives (pressure/temperature gauge cluster; abstract distribution node-network). An animated SVG line-art schematic of a compressor + coil + valve assembly that draws itself in (stroke animation) on load, with an ember-colored dot travelling along a connector line to suggest flow. Replaces the current generic radial dot-grid background — a literal, on-brand visual instead of a generic decorative pattern. Rendered in `--blue-300` strokes on `--ink-950`, at low-to-moderate opacity so it reads as background texture rather than competing with the hero headline/search bar. Simplified or hidden below `md` breakpoint if legibility suffers at small sizes (implementation to verify at build time).
- **Motion ambition: full tier** — chosen over two lighter alternatives (refine existing animations only; refine + text reveals/hover only):
  1. Refine existing hero-entrance, scroll-reveal, and count-up animations by rebuilding them on GSAP/ScrollTrigger with better easing/choreography.
  2. Add `SplitText`-driven headline reveals (word/line stagger) on the H1 and H2s.
  3. Add hover micro-interactions: magnetic/spring hover on the primary CTA and product-line cards (`gsap.quickTo` on `x`/`y` tracking mouse position).
  4. Add the animated `HeroBlueprint` signature element: draw-in (once, on mount) + a continuously looping flowing dot along the connector line, plus a subtle parallax shift (`ScrollTrigger` `scrub`, vertical translate only) as the hero scrolls out of view. No mouse-tracking/cursor-reactive behavior on the blueprint itself — that's reserved for the CTA/card hover magnetism in point 3, keeping the blueprint's interaction surface simple and unambiguous to implement.
- **Spacing: generous, deliberately increased.** Hero `pt-24 pb-20` → `pt-32 pb-28 lg:pt-40`; section `py-16` → `py-24 lg:py-28`; tighter `max-w` reading widths on text blocks paired with the larger serif headline sizes.

## Component & file changes

### `apps/shop/package.json`
Add `gsap` as a new dependency (includes ScrollTrigger and SplitText — both free since Webflow's 2025 GSAP license change; no separate Club GreenSock purchase needed). Add `@fontsource/source-serif-4`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`.

### `apps/shop/src/modules/landing/components/HeroBlueprint.vue` (new)
Self-contained component rendering the blueprint SVG and owning its GSAP draw-in/flow timeline. Builds its timeline in `onMounted`, `.revert()`s it in `onUnmounted`, checks `usePreferredReducedMotion` (from the already-available `@vueuse/core`) before animating at all.

### `apps/shop/src/modules/landing/composables/useLandingMotion.ts` (new)
Centralizes the rest of the page's GSAP work: hero text entrance (`SplitText` + timeline, replacing the current `.hero-entrance`/`hero-delay-*` CSS classes), section scroll-reveals (`ScrollTrigger`, replacing `IntersectionObserver` + `sr-pending`/`sr-active`), the stats count-up (`gsap.to()` on refs, replacing the manual `requestAnimationFrame` easing function), and the CTA/card hover magnetism. Mirrors the existing `onMounted`/`onUnmounted` observer-cleanup idiom already used in this same file today. Registers `gsap.registerPlugin(ScrollTrigger, SplitText)` once at module scope.

### `apps/shop/src/modules/landing/views/LandingView.vue`
Same section structure (hero, product lines directory, calc banner, trust bar) — no content/copy changes, no changes to `handleSearch`/`productLines`/`benefits` logic. Changes are: new type scale and spacing utility classes, new color custom properties + arbitrary-value utility classes replacing `slate-900`/`brand-*`/`accent-*` within this view only, swap-in of `HeroBlueprint` in place of the current dot-grid `<div>`, and replacing the `<script setup>` animation code (hero entrance refs, `IntersectionObserver` setup, `animateCount`) with calls into `useLandingMotion`.

### Reduced motion
Unchanged behavior from today, now centralized: when `usePreferredReducedMotion() === 'reduce'`, `useLandingMotion` and `HeroBlueprint` skip building any GSAP timeline/ScrollTrigger instance entirely and set all animated elements directly to their end state — no motion, no `SplitText` splitting, no listeners to clean up.

## Non-goals (explicitly out of scope)

- No changes to `packages/ui/tokens.css` — `brand`/`accent`/`--font-sans` tokens are untouched, so catalog, calculator, dashboard, `AppHeader`, and `AppFooter` are visually unaffected.
- No dark-mode system or theme toggle — Midnight & Ember is a fixed dark treatment for this one page, not a light/dark pair.
- No changes to `apps/calculator` or `apps/dashboard` package.json — `gsap`/`@fontsource/*` are added to `apps/shop` only.
- No copy/content changes — same Spanish B2B copy, same product-line data, same benefits list, same calculator URL/env var.
- No changes to routing, search behavior, or any Pinia store.
- No shared animation composable in `packages/ui` — despite the exploration finding that the "custom transition + reduced-motion query" pattern also appears in `ProductDetailView.vue` and `AppToast.vue`, unifying those is out of scope here (YAGNI — no request to touch them, and centralizing prematurely risks over-abstracting a pattern used in only 3 places for different purposes).

## Testing

- New `apps/shop/src/modules/landing/views/LandingView.test.ts` (none exists today):
  - Renders without throwing with `usePreferredReducedMotion` mocked to `'reduce'` — verifies the no-motion path leaves all content visible/interactive (search form, product line links, calculator CTA) with no reliance on animation completing.
  - Search form still calls `router.push` with the typed query on submit (existing `handleSearch` behavior, unchanged).
  - Product line links and "Ver todo" still render correct `to` targets from `catalogStore.productLines`.
  - Stats end at their correct final values (`5000`, `50`, `15`) regardless of motion path.
- New `apps/shop/src/modules/landing/components/HeroBlueprint.test.ts`:
  - Renders the SVG without throwing.
  - With reduced motion mocked on, no GSAP timeline is created (spy/mock `gsap.timeline`) and `onUnmounted` does not throw when nothing was built.
- Manual verification in the running app (`npm run dev:shop`) covering: hero load-in, scroll-triggered section reveals, hover states on CTA/cards, and an OS-level "reduce motion" toggle check, since GSAP/ScrollTrigger timing and SplitText line-splitting behavior are best confirmed visually, not just via component mount tests.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `SplitText` (a paid GSAP "Club" plugin historically) behaving differently than expected post-license-change | Low | GreenSock/Webflow made all bonus plugins (including `SplitText`) free and part of the standard `gsap` npm package as of the 2025 licensing change — confirmed to be importable as `gsap/SplitText` with no separate license key. Implementation should verify this against the installed version at build time and fall back to a simple opacity/translate stagger (no `SplitText`) if it's unavailable. |
| Blueprint SVG line-art becomes visually cluttered/illegible over the centered hero text, especially on smaller desktop widths | Medium | Low opacity strokes, positioned as background texture rather than a foreground graphic; simplified/hidden on mobile; verified visually during implementation, not just specified on paper. |
| New serif/mono web fonts increase the landing page's initial bundle/network weight vs. today's system-font fallback | Low | Self-hosted via `@fontsource` with `font-display: swap`; only 3 weight/family combinations are added (600 serif, regular/medium sans, regular/medium mono), not a large multi-weight family. |
| Duplicating the "reduced-motion + custom transition" pattern a fourth time (after Landing, `ProductDetailView`, `AppToast`) instead of centralizing it | Accepted | Explicitly deferred as a non-goal (YAGNI) — revisit only if a fourth or fifth consumer appears, at which point extracting a shared `packages/ui` composable becomes justified by real duplication rather than anticipated duplication. |
