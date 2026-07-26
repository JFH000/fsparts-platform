# Landing Page Art Direction & GSAP Motion Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `apps/shop/src/modules/landing/views/LandingView.vue` with a new typography/color identity (Source Serif 4 + IBM Plex Sans + IBM Plex Mono, "Midnight & Ember" palette) and GSAP-powered motion (hero SplitText reveal, ScrollTrigger section reveals, animated blueprint hero graphic, magnetic hover), replacing the current hand-rolled CSS/IntersectionObserver/rAF animation code.

**Architecture:** Two new small, focused files carry the new behavior — `useLandingMotion.ts` (a composable owning all GSAP timelines/ScrollTriggers for the page, built in `onMounted`/reverted in `onUnmounted` via `gsap.context()`) and `HeroBlueprint.vue` (a self-contained animated SVG component with its own mount/unmount GSAP lifecycle). `LandingView.vue` is rewritten to use both, with its content/logic (search, product lines, benefits, calculator link) untouched.

**Tech Stack:** Vue 3.5 Composition API (`<script setup>`), Vue Router 4, Pinia 3, Tailwind CSS v4, GSAP 3.13+ (core + ScrollTrigger + SplitText + MotionPathPlugin, all free), `@fontsource/*` self-hosted fonts, `@vueuse/core` (`usePreferredReducedMotion`), Vitest + `@vue/test-utils`.

## Global Constraints

- Scope is `apps/shop` only. Do not touch `packages/ui/tokens.css`, `AppHeader.vue`, `AppFooter.vue`, or any file in `apps/calculator`/`apps/dashboard`.
- New palette/typography are CSS custom properties scoped to a `.landing-page` wrapper class inside `LandingView.vue`'s `<style scoped>` block — never promoted to shared tokens.
- Palette (exact hex, from the approved spec): `--ink-950: #060B18`, `--ink-900: #0B1226`, `--landing-blue-500: #395FC4`, `--landing-blue-300: #7C97D6`, `--ember-500: #E85D3D`.
- Fonts: self-hosted via `@fontsource/source-serif-4` (weight 600), `@fontsource/ibm-plex-sans` (400/500/600), `@fontsource/ibm-plex-mono` (400/500) — imported inside `LandingView.vue`'s `<script setup>`, never as a Google Fonts `<link>`.
- New dependencies (`gsap`, `@fontsource/*`) go in `apps/shop/package.json` only.
- `prefers-reduced-motion: reduce` (via `usePreferredReducedMotion()` from `@vueuse/core`) must fully disable all GSAP timelines/ScrollTriggers — content renders at final state with no motion and nothing to clean up.
- No copy/content changes. No changes to `handleSearch`, `productLines`, `benefits`, routing, or any Pinia store.
- No new shared composable in `packages/ui` (explicit non-goal in the spec — YAGNI).
- Full design rationale: `docs/superpowers/specs/2026-07-25-landing-page-redesign-design.md`.

---

## Task 1: Install GSAP and font dependencies

**Files:**
- Modify: `apps/shop/package.json`

**Interfaces:**
- Produces: `gsap` (with `gsap/ScrollTrigger`, `gsap/SplitText`, `gsap/MotionPathPlugin` subpath exports), `@fontsource/source-serif-4`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` — all importable from any file under `apps/shop/src` starting with Task 2.

- [ ] **Step 1: Add the new dependencies to `apps/shop/package.json`**

Edit the `"dependencies"` block so it reads:

```json
  "dependencies": {
    "@fontsource/ibm-plex-mono": "^5.0.0",
    "@fontsource/ibm-plex-sans": "^5.0.0",
    "@fontsource/source-serif-4": "^5.0.0",
    "@fsparts/core": "*",
    "@fsparts/ui": "*",
    "@lucide/vue": "^1.17.0",
    "@vueuse/core": "^14.3.0",
    "gsap": "^3.13.0",
    "pinia": "^3.0.4",
    "vue": "^3.5.34",
    "vue-router": "^4.6.4"
  }
```

- [ ] **Step 2: Install from the repo root (this is an npm workspaces monorepo)**

Run: `npm install`
Expected: lockfile updates, `node_modules/gsap` and the three `node_modules/@fontsource/*` packages exist, no errors.

- [ ] **Step 3: Verify the existing test suite still passes**

Run: `npm run test`
Expected: PASS (same results as before this change — this step only proves the install didn't break anything, no new tests exist yet).

- [ ] **Step 4: Commit**

```bash
git add apps/shop/package.json package-lock.json
git commit -m "chore(shop): add gsap and fontsource dependencies for landing redesign"
```

---

## Task 2: `useLandingMotion` composable — reduced-motion path

**Files:**
- Create: `apps/shop/src/modules/landing/composables/useLandingMotion.ts`
- Test: `apps/shop/src/modules/landing/composables/__tests__/useLandingMotion.reducedMotion.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface LandingMotionTargets {
    heroBadge: Ref<HTMLElement | null>
    heroTitle: Ref<HTMLElement | null>
    heroSubtitle: Ref<HTMLElement | null>
    heroSearch: Ref<HTMLElement | null>
    heroCta: Ref<HTMLElement | null>
    heroLinks: Ref<HTMLElement | null>
    heroStats: Ref<HTMLElement | null>
    linesSection: Ref<HTMLElement | null>
    calcSection: Ref<HTMLElement | null>
    trustSection: Ref<HTMLElement | null>
    countProducts: Ref<number>
    countBrands: Ref<number>
    countYears: Ref<number>
  }
  export function useLandingMotion(targets: LandingMotionTargets): void
  ```
- Consumes: `usePreferredReducedMotion` from `@vueuse/core` (already a dependency), `gsap`/`gsap/ScrollTrigger`/`gsap/SplitText` from Task 1.

- [ ] **Step 1: Write the failing test**

Create `apps/shop/src/modules/landing/composables/__tests__/useLandingMotion.reducedMotion.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, usePreferredReducedMotion: () => ref('reduce') }
})

vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      fn()
      return { revert: vi.fn() }
    }),
    set: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    timeline: vi.fn(() => ({ to: vi.fn().mockReturnThis() })),
    quickTo: vi.fn(() => vi.fn()),
  },
}))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))
vi.mock('gsap/SplitText', () => ({ SplitText: vi.fn() }))

import { useLandingMotion } from '../useLandingMotion'
import { gsap } from 'gsap'

function mountWithMotion() {
  const el = ref<HTMLElement | null>(null)
  const countProducts = ref(0)
  const countBrands = ref(0)
  const countYears = ref(0)

  const Host = defineComponent({
    setup() {
      useLandingMotion({
        heroBadge: el, heroTitle: el, heroSubtitle: el, heroSearch: el, heroCta: el,
        heroLinks: el, heroStats: el, linesSection: el, calcSection: el, trustSection: el,
        countProducts, countBrands, countYears,
      })
      return () => h('div', { ref: el })
    },
  })

  mount(Host)
  return { countProducts, countBrands, countYears }
}

describe('useLandingMotion — reduced motion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('snaps stat counters to their final values without building a GSAP context', () => {
    const { countProducts, countBrands, countYears } = mountWithMotion()

    expect(countProducts.value).toBe(5000)
    expect(countBrands.value).toBe(50)
    expect(countYears.value).toBe(15)
    expect(gsap.context).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/shop -- useLandingMotion.reducedMotion`
Expected: FAIL — `Cannot find module '../useLandingMotion'` (file doesn't exist yet).

- [ ] **Step 3: Write the composable (reduced-motion branch only for now)**

Create `apps/shop/src/modules/landing/composables/useLandingMotion.ts`:

```ts
import { onMounted, onUnmounted, type Ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export interface LandingMotionTargets {
  heroBadge: Ref<HTMLElement | null>
  heroTitle: Ref<HTMLElement | null>
  heroSubtitle: Ref<HTMLElement | null>
  heroSearch: Ref<HTMLElement | null>
  heroCta: Ref<HTMLElement | null>
  heroLinks: Ref<HTMLElement | null>
  heroStats: Ref<HTMLElement | null>
  linesSection: Ref<HTMLElement | null>
  calcSection: Ref<HTMLElement | null>
  trustSection: Ref<HTMLElement | null>
  countProducts: Ref<number>
  countBrands: Ref<number>
  countYears: Ref<number>
}

export function useLandingMotion(targets: LandingMotionTargets) {
  const reducedMotion = usePreferredReducedMotion()

  function snapToFinalState() {
    targets.countProducts.value = 5000
    targets.countBrands.value = 50
    targets.countYears.value = 15
  }

  onMounted(() => {
    if (reducedMotion.value === 'reduce') {
      snapToFinalState()
      return
    }
    // full-motion path added in Task 3
  })

  onUnmounted(() => {
    // context revert added in Task 3
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/shop -- useLandingMotion.reducedMotion`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/shop/src/modules/landing/composables/useLandingMotion.ts apps/shop/src/modules/landing/composables/__tests__/useLandingMotion.reducedMotion.test.ts
git commit -m "feat(shop): add useLandingMotion reduced-motion path"
```

---

## Task 3: `useLandingMotion` — full motion path

**Files:**
- Modify: `apps/shop/src/modules/landing/composables/useLandingMotion.ts`
- Test: `apps/shop/src/modules/landing/composables/__tests__/useLandingMotion.fullMotion.test.ts`

**Interfaces:**
- Consumes: `LandingMotionTargets` from Task 2 (unchanged).
- Produces: same `useLandingMotion` export signature — no change to how Task 5 calls it.

- [ ] **Step 1: Write the failing test**

Create `apps/shop/src/modules/landing/composables/__tests__/useLandingMotion.fullMotion.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, usePreferredReducedMotion: () => ref('no-preference') }
})

vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      fn()
      return { revert: vi.fn() }
    }),
    set: vi.fn(),
    to: vi.fn(),
    from: vi.fn(),
    timeline: vi.fn(() => {
      const tl = { to: vi.fn(() => tl) }
      return tl
    }),
    quickTo: vi.fn(() => vi.fn()),
  },
}))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))
vi.mock('gsap/SplitText', () => ({
  SplitText: vi.fn().mockImplementation(() => ({ lines: [], revert: vi.fn() })),
}))

import { useLandingMotion } from '../useLandingMotion'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

function mountWithMotion() {
  const el = ref<HTMLElement | null>(document.createElement('div'))
  const countProducts = ref(0)
  const countBrands = ref(0)
  const countYears = ref(0)

  const Host = defineComponent({
    setup() {
      useLandingMotion({
        heroBadge: el, heroTitle: el, heroSubtitle: el, heroSearch: el, heroCta: el,
        heroLinks: el, heroStats: el, linesSection: el, calcSection: el, trustSection: el,
        countProducts, countBrands, countYears,
      })
      return () => h('div')
    },
  })

  return mount(Host)
}

describe('useLandingMotion — full motion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('registers ScrollTrigger and SplitText at module load', () => {
    expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger, SplitText)
  })

  it('builds a GSAP context on mount and reverts it on unmount', () => {
    const wrapper = mountWithMotion()

    expect(gsap.context).toHaveBeenCalledTimes(1)

    const contextResult = (gsap.context as any).mock.results[0].value
    wrapper.unmount()

    expect(contextResult.revert).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/shop -- useLandingMotion.fullMotion`
Expected: FAIL — `gsap.context` was never called (composable currently does nothing on the non-reduced-motion branch).

- [ ] **Step 3: Implement the full motion path**

Replace the body of `apps/shop/src/modules/landing/composables/useLandingMotion.ts` with:

```ts
import { onMounted, onUnmounted, type Ref } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

export interface LandingMotionTargets {
  heroBadge: Ref<HTMLElement | null>
  heroTitle: Ref<HTMLElement | null>
  heroSubtitle: Ref<HTMLElement | null>
  heroSearch: Ref<HTMLElement | null>
  heroCta: Ref<HTMLElement | null>
  heroLinks: Ref<HTMLElement | null>
  heroStats: Ref<HTMLElement | null>
  linesSection: Ref<HTMLElement | null>
  calcSection: Ref<HTMLElement | null>
  trustSection: Ref<HTMLElement | null>
  countProducts: Ref<number>
  countBrands: Ref<number>
  countYears: Ref<number>
}

function attachMagnetic(el: HTMLElement, strength: number): () => void {
  const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' })
  const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' })

  function onMove(e: MouseEvent) {
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - rect.left - rect.width / 2
    const relY = e.clientY - rect.top - rect.height / 2
    xTo((relX / rect.width) * strength)
    yTo((relY / rect.height) * strength)
  }
  function onLeave() {
    xTo(0)
    yTo(0)
  }

  el.addEventListener('mousemove', onMove)
  el.addEventListener('mouseleave', onLeave)

  return () => {
    el.removeEventListener('mousemove', onMove)
    el.removeEventListener('mouseleave', onLeave)
  }
}

export function useLandingMotion(targets: LandingMotionTargets) {
  const reducedMotion = usePreferredReducedMotion()
  let ctx: ReturnType<typeof gsap.context> | null = null
  let magneticCleanups: Array<() => void> = []

  function snapToFinalState() {
    targets.countProducts.value = 5000
    targets.countBrands.value = 50
    targets.countYears.value = 15
  }

  function animate() {
    ctx = gsap.context(() => {
      const heroEls = [
        targets.heroBadge.value,
        targets.heroSubtitle.value,
        targets.heroSearch.value,
        targets.heroLinks.value,
        targets.heroStats.value,
      ].filter((el): el is HTMLElement => el !== null)

      gsap.set(heroEls, { autoAlpha: 0, y: 16 })

      const tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.65 } })

      if (targets.heroTitle.value) {
        const split = new SplitText(targets.heroTitle.value, { type: 'lines' })
        gsap.set(split.lines, { yPercent: 100, autoAlpha: 0 })
        tl.to(split.lines, { yPercent: 0, autoAlpha: 1, stagger: 0.08 }, 0.1)
      }

      tl.to(targets.heroBadge.value,    { autoAlpha: 1, y: 0 }, 0.05)
        .to(targets.heroSubtitle.value, { autoAlpha: 1, y: 0 }, 0.4)
        .to(targets.heroSearch.value,   { autoAlpha: 1, y: 0 }, 0.5)
        .to(targets.heroLinks.value,    { autoAlpha: 1, y: 0 }, 0.58)
        .to(targets.heroStats.value,    { autoAlpha: 1, y: 0 }, 0.64)

      const counters = { products: 0, brands: 0, years: 0 }
      gsap.to(counters, {
        products: 5000,
        brands: 50,
        years: 15,
        duration: 1.6,
        ease: 'power3.out',
        scrollTrigger: { trigger: targets.heroStats.value, start: 'top 90%', once: true },
        onUpdate: () => {
          targets.countProducts.value = Math.round(counters.products)
          targets.countBrands.value = Math.round(counters.brands)
          targets.countYears.value = Math.round(counters.years)
        },
      })

      for (const section of [targets.linesSection.value, targets.calcSection.value, targets.trustSection.value]) {
        if (!section) continue
        gsap.from(section, {
          autoAlpha: 0,
          y: 24,
          duration: 0.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: section, start: 'top 85%', once: true },
        })
      }

      if (targets.heroCta.value) {
        magneticCleanups.push(attachMagnetic(targets.heroCta.value, 10))
      }
      if (targets.heroLinks.value) {
        targets.heroLinks.value.querySelectorAll<HTMLElement>('a').forEach((card) => {
          magneticCleanups.push(attachMagnetic(card, 8))
        })
      }
    })
  }

  onMounted(() => {
    if (reducedMotion.value === 'reduce') {
      snapToFinalState()
      return
    }
    animate()
  })

  onUnmounted(() => {
    ctx?.revert()
    magneticCleanups.forEach((cleanup) => cleanup())
    magneticCleanups = []
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/shop -- useLandingMotion`
Expected: PASS (both `useLandingMotion.reducedMotion.test.ts` and `useLandingMotion.fullMotion.test.ts` green).

- [ ] **Step 5: Commit**

```bash
git add apps/shop/src/modules/landing/composables/useLandingMotion.ts apps/shop/src/modules/landing/composables/__tests__/useLandingMotion.fullMotion.test.ts
git commit -m "feat(shop): add useLandingMotion full GSAP motion path"
```

---

## Task 4: `HeroBlueprint.vue` component

**Files:**
- Create: `apps/shop/src/modules/landing/components/HeroBlueprint.vue`
- Test: `apps/shop/src/modules/landing/components/__tests__/HeroBlueprint.reducedMotion.test.ts`
- Test: `apps/shop/src/modules/landing/components/__tests__/HeroBlueprint.fullMotion.test.ts`

**Interfaces:**
- Produces: `HeroBlueprint` — a props-less, emits-less Vue SFC whose root element is a single `<svg>` (so `class`/`style` passed by a parent fall through onto it).

- [ ] **Step 1: Write the failing tests**

Create `apps/shop/src/modules/landing/components/__tests__/HeroBlueprint.reducedMotion.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, usePreferredReducedMotion: () => ({ value: 'reduce' }) }
})

vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      fn()
      return { revert: vi.fn() }
    }),
    set: vi.fn(),
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}))
vi.mock('gsap/MotionPathPlugin', () => ({ MotionPathPlugin: {} }))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))

import HeroBlueprint from '../HeroBlueprint.vue'
import { gsap } from 'gsap'

describe('HeroBlueprint — reduced motion', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the schematic SVG at full opacity without building a GSAP context', () => {
    const wrapper = mount(HeroBlueprint)

    expect(wrapper.find('svg').exists()).toBe(true)
    expect(gsap.context).not.toHaveBeenCalled()
    expect(gsap.set).toHaveBeenCalled()
  })
})
```

Create `apps/shop/src/modules/landing/components/__tests__/HeroBlueprint.fullMotion.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, usePreferredReducedMotion: () => ({ value: 'no-preference' }) }
})

vi.mock('gsap', () => ({
  gsap: {
    registerPlugin: vi.fn(),
    context: vi.fn((fn: () => void) => {
      fn()
      return { revert: vi.fn() }
    }),
    set: vi.fn(),
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}))
vi.mock('gsap/MotionPathPlugin', () => ({ MotionPathPlugin: {} }))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))

import HeroBlueprint from '../HeroBlueprint.vue'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// jsdom (this project's version: 29.1.1) implements no SVG layout engine and does not
// even expose SVGGeometryElement/SVGRectElement as globals — every SVG shape element's
// prototype chain resolves directly to the generic SVGElement. getTotalLength (called
// directly by the component, not through gsap) does not exist there — stub it on
// SVGElement.prototype once for this file.
beforeAll(() => {
  SVGElement.prototype.getTotalLength = () => 100
})

describe('HeroBlueprint — full motion', () => {
  // In a `<script setup>` SFC, only bare `import` statements run at real module-load
  // time — Vue's compiler moves every other top-level statement (including the bare
  // `gsap.registerPlugin(...)` call) into the component's generated `setup()` function
  // body, so it only executes once the component is actually mounted, not merely
  // imported. Every test below therefore calls `mount()` itself; `beforeEach` clears
  // mocks between them so each test's call counts and `.mock.results[0]` indexing stay
  // isolated to its own mount instead of accumulating across tests.
  beforeEach(() => vi.clearAllMocks())

  it('registers MotionPathPlugin and ScrollTrigger when the component mounts', () => {
    mount(HeroBlueprint)

    expect(gsap.registerPlugin).toHaveBeenCalledWith(MotionPathPlugin, ScrollTrigger)
  })

  it('builds a GSAP context on mount and reverts it on unmount', () => {
    const wrapper = mount(HeroBlueprint)

    expect(gsap.context).toHaveBeenCalledTimes(1)

    const contextResult = (gsap.context as any).mock.results[0].value
    wrapper.unmount()

    expect(contextResult.revert).toHaveBeenCalledTimes(1)
  })

  it('sets up a scroll-scrubbed parallax tween on the root SVG', () => {
    mount(HeroBlueprint)

    const scrollTriggerCall = (gsap.to as any).mock.calls.find(
      ([, vars]: [unknown, any]) => vars?.scrollTrigger?.scrub,
    )
    expect(scrollTriggerCall).toBeDefined()
    expect(scrollTriggerCall[1].scrollTrigger.scrub).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/shop -- HeroBlueprint`
Expected: FAIL — `Cannot find module '../HeroBlueprint.vue'`.

- [ ] **Step 3: Implement the component**

Create `apps/shop/src/modules/landing/components/HeroBlueprint.vue`:

```vue
<template>
  <svg
    ref="rootRef"
    viewBox="0 0 400 260"
    preserveAspectRatio="xMidYMid slice"
    fill="none"
    aria-hidden="true"
  >
    <rect ref="bodyRef" x="40" y="100" width="110" height="70" rx="10" stroke="var(--landing-blue-300)" stroke-width="2" />
    <circle ref="portLeftRef" cx="40" cy="135" r="6" stroke="var(--landing-blue-300)" stroke-width="2" />
    <circle ref="portRightRef" cx="150" cy="135" r="6" stroke="var(--landing-blue-300)" stroke-width="2" />
    <path ref="connectorRef" d="M150 135 H 210" stroke="var(--landing-blue-300)" stroke-width="2" />
    <path ref="coilRef" d="M210 135 L225 95 L240 175 L255 95 L270 175 L285 95 L300 175 L315 95 L330 135 L340 135" stroke="var(--landing-blue-300)" stroke-width="2" stroke-linejoin="round" />
    <path ref="valveLineRef" d="M95 170 V 208" stroke="var(--landing-blue-300)" stroke-width="2" />
    <polygon ref="valveRef" points="95,205 112,222 95,239 78,222" stroke="var(--ember-500)" stroke-width="2" />
    <circle ref="dotRef" r="3.5" fill="var(--ember-500)" opacity="0" />
  </svg>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { usePreferredReducedMotion } from '@vueuse/core'
import { gsap } from 'gsap'
import { MotionPathPlugin } from 'gsap/MotionPathPlugin'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(MotionPathPlugin, ScrollTrigger)

const rootRef = ref<SVGSVGElement | null>(null)
const bodyRef = ref<SVGGeometryElement | null>(null)
const portLeftRef = ref<SVGGeometryElement | null>(null)
const portRightRef = ref<SVGGeometryElement | null>(null)
const connectorRef = ref<SVGGeometryElement | null>(null)
const coilRef = ref<SVGGeometryElement | null>(null)
const valveLineRef = ref<SVGGeometryElement | null>(null)
const valveRef = ref<SVGGeometryElement | null>(null)
const dotRef = ref<SVGCircleElement | null>(null)

const reducedMotion = usePreferredReducedMotion()
let ctx: ReturnType<typeof gsap.context> | null = null

function strokeRefs(): SVGGeometryElement[] {
  return [
    bodyRef.value, portLeftRef.value, portRightRef.value,
    connectorRef.value, coilRef.value, valveLineRef.value, valveRef.value,
  ].filter((el): el is SVGGeometryElement => el !== null)
}

onMounted(() => {
  const strokes = strokeRefs()

  if (reducedMotion.value === 'reduce') {
    gsap.set(strokes, { opacity: 1 })
    if (dotRef.value) gsap.set(dotRef.value, { opacity: 0 })
    return
  }

  ctx = gsap.context(() => {
    strokes.forEach((el, i) => {
      const length = el.getTotalLength()
      gsap.fromTo(
        el,
        { strokeDasharray: length, strokeDashoffset: length },
        { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut', delay: i * 0.08 },
      )
    })

    if (dotRef.value && connectorRef.value) {
      gsap.to(dotRef.value, { opacity: 1, delay: 1.2, duration: 0.2 })
      gsap.to(dotRef.value, {
        motionPath: { path: connectorRef.value, autoRotate: false },
        duration: 2.4,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 1.2,
      })
    }

    if (rootRef.value) {
      gsap.to(rootRef.value, {
        yPercent: 12,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.value,
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      })
    }
  })
})

onUnmounted(() => {
  ctx?.revert()
})
</script>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=apps/shop -- HeroBlueprint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/shop/src/modules/landing/components/HeroBlueprint.vue apps/shop/src/modules/landing/components/__tests__/HeroBlueprint.reducedMotion.test.ts apps/shop/src/modules/landing/components/__tests__/HeroBlueprint.fullMotion.test.ts
git commit -m "feat(shop): add animated HeroBlueprint signature element"
```

---

## Task 5: Rewrite `LandingView.vue`

**Files:**
- Modify: `apps/shop/src/modules/landing/views/LandingView.vue`
- Test: `apps/shop/src/modules/landing/views/__tests__/LandingView.test.ts`

**Interfaces:**
- Consumes: `useLandingMotion`/`LandingMotionTargets` (Task 3), `HeroBlueprint` (Task 4). `catalogStore.productLines` (unchanged, from `@/modules/catalog/stores/catalog.store`).

- [ ] **Step 1: Write the failing test**

Create `apps/shop/src/modules/landing/views/__tests__/LandingView.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'

vi.mock('../../composables/useLandingMotion', () => ({ useLandingMotion: vi.fn() }))

async function mountView() {
  const { default: LandingView } = await import('../LandingView.vue')
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', name: 'landing', component: LandingView },
      { path: '/catalog', name: 'catalog', component: { template: '<div />' } },
    ],
  })
  router.push('/')
  await router.isReady()

  return mount(LandingView, {
    global: { plugins: [router], stubs: { HeroBlueprint: true } },
  })
}

describe('LandingView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the hero heading and every product line from the catalog store', async () => {
    const wrapper = await mountView()
    const catalogStore = useCatalogStore()

    expect(wrapper.text()).toContain('Tu distribuidor')
    for (const line of catalogStore.productLines) {
      expect(wrapper.text()).toContain(line.name)
    }
  })

  it('navigates to /catalog with the typed search query on submit', async () => {
    const wrapper = await mountView()
    const pushSpy = vi.spyOn(wrapper.vm.$router, 'push')

    await wrapper.find('input[aria-label="Buscar productos"]').setValue('compresor')
    await wrapper.find('form').trigger('submit.prevent')

    expect(pushSpy).toHaveBeenCalledWith({ path: '/catalog', query: { q: 'compresor' } })
  })

  it('does not navigate when the search query is empty', async () => {
    const wrapper = await mountView()
    const pushSpy = vi.spyOn(wrapper.vm.$router, 'push')

    await wrapper.find('form').trigger('submit.prevent')

    expect(pushSpy).not.toHaveBeenCalled()
  })

  it('links the calculator CTA to the configured calculator URL', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('a[href*="calculator"]').exists()).toBe(true)
  })

  it('renders all four trust-bar benefits', async () => {
    const wrapper = await mountView()
    expect(wrapper.text()).toContain('Envío rápido')
    expect(wrapper.text()).toContain('Garantía total')
    expect(wrapper.text()).toContain('Soporte técnico')
    expect(wrapper.text()).toContain('Distribuidor oficial')
  })
})
```

Note: stat counter values (5000/50/15) are already covered at the unit level in `useLandingMotion.reducedMotion.test.ts` (Task 2). `useLandingMotion` is mocked out entirely here so this file stays focused on `LandingView`'s own rendering/interaction responsibilities rather than re-testing motion internals.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/shop -- LandingView`
Expected: FAIL — assertions about hero/product-line text still pass against the *current* file (it's a rewrite, not a new file), but this confirms the harness (router/pinia/mocks) works before touching the view. If it already passes as-is, proceed straight to Step 3 — this step exists to catch a broken test harness, not to force a red state on unrelated code.

- [ ] **Step 3: Rewrite the component**

Replace the entire contents of `apps/shop/src/modules/landing/views/LandingView.vue` with:

```vue
<template>
  <div class="landing-page">
    <!-- ─────────────────── HERO ─────────────────── -->
    <section class="relative overflow-hidden bg-[var(--ink-950)]">
      <HeroBlueprint class="absolute inset-0 h-full w-full opacity-[0.22] hidden md:block" />
      <div class="absolute inset-0 bg-gradient-to-br from-[var(--ink-900)]/80 via-[var(--ink-950)]/60 to-[var(--ink-950)]" aria-hidden="true" />

      <div class="relative z-10 max-w-7xl mx-auto px-4 pt-32 pb-28 lg:pt-40 flex flex-col items-center text-center">

        <div ref="heroBadge" class="landing-mono inline-flex items-center gap-2 bg-white/[0.07] border border-white/[0.12] rounded-full px-4 py-1.5 text-slate-300 text-xs mb-8">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true"></span>
          Distribución especializada · HVAC/R industrial y comercial
        </div>

        <h1 ref="heroTitle" class="landing-serif text-5xl md:text-6xl lg:text-8xl font-semibold text-white leading-[1.05] mb-6 max-w-4xl text-balance">
          Tu distribuidor
          <span class="text-[var(--landing-blue-300)]"> HVAC/R</span>
          <span class="text-white"> de confianza</span>
        </h1>

        <p ref="heroSubtitle" class="text-lg text-slate-300 mb-10 max-w-2xl leading-relaxed text-pretty">
          Compresores, válvulas, refrigerantes, filtros e intercambiadores de calor.
          Todo para refrigeración y aire acondicionado industrial y comercial.
        </p>

        <form ref="heroSearch" @submit.prevent="handleSearch" class="flex gap-0 w-full max-w-2xl mb-8">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nombre, SKU o marca..."
            aria-label="Buscar productos"
            class="min-w-0 flex-1 px-4 sm:px-6 py-3.5 sm:py-4 text-sm sm:text-base rounded-l-full border-0 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--landing-blue-500)] shadow-xl"
          />
          <button
            ref="heroCta"
            type="submit"
            class="flex-shrink-0 bg-[var(--ember-500)] hover:brightness-110 text-white px-4 sm:px-7 py-3.5 sm:py-4 rounded-r-full font-semibold text-sm sm:text-base transition-[filter] shadow-xl flex items-center gap-2"
          >
            <Search class="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span class="hidden sm:inline">Buscar</span>
          </button>
        </form>

        <div ref="heroLinks" class="flex flex-wrap justify-center gap-2 mb-14">
          <RouterLink
            v-for="line in productLines.slice(0, 5)"
            :key="line.id"
            :to="`/catalog?line=${line.code}`"
            class="flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.13] text-slate-300 hover:text-white text-xs px-4 py-2 rounded-full transition-all duration-150"
          >
            <component :is="lineIcon(line.icon)" class="h-3.5 w-3.5 text-[var(--landing-blue-300)]" aria-hidden="true" />
            {{ line.name.split(' ')[0] }}
          </RouterLink>
          <RouterLink
            to="/catalog"
            class="flex items-center gap-1 bg-[var(--ember-500)]/20 hover:bg-[var(--ember-500)]/35 border border-[var(--ember-500)]/40 text-white font-semibold text-xs px-4 py-2 rounded-full transition-all duration-150"
          >
            Ver todo <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
          </RouterLink>
        </div>

        <div ref="heroStats" class="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm">
          <span class="text-slate-400">
            <span class="landing-mono text-white font-bold tabular-nums">{{ countProducts.toLocaleString('es-CO') }}+</span>
            <span class="ml-1">referencias en stock</span>
          </span>
          <span class="text-slate-700 hidden sm:block" aria-hidden="true">·</span>
          <span class="text-slate-400">
            <span class="landing-mono text-white font-bold tabular-nums">{{ countBrands }}+</span>
            <span class="ml-1">marcas</span>
          </span>
          <span class="text-slate-700 hidden sm:block" aria-hidden="true">·</span>
          <span class="text-slate-400">
            <span class="landing-mono text-white font-bold tabular-nums">{{ countYears }}</span>
            <span class="ml-1">años distribuyendo</span>
          </span>
        </div>
      </div>

      <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent" aria-hidden="true" />
    </section>

    <!-- ─────────────────── PRODUCT LINES — directory ─────────────────── -->
    <section ref="linesSection" class="max-w-7xl mx-auto px-4 py-24 lg:py-28">
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="landing-serif text-2xl font-semibold text-slate-900 text-balance">Líneas de Producto</h2>
        <RouterLink
          to="/catalog"
          class="text-sm font-medium text-[var(--landing-blue-500)] hover:brightness-90 flex items-center gap-1 transition-colors"
        >
          Ver catálogo completo <ArrowRight class="h-4 w-4" aria-hidden="true" />
        </RouterLink>
      </div>

      <div class="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
        <RouterLink
          v-for="line in productLines"
          :key="line.id"
          :to="`/catalog?line=${line.code}`"
          class="group flex items-center gap-3 px-5 py-3.5 bg-white hover:bg-slate-50 transition-colors duration-150"
        >
          <span class="landing-mono text-sm font-bold text-[var(--landing-blue-500)] w-10 flex-shrink-0">
            {{ line.code }}
          </span>
          <div
            class="w-6 h-6 rounded bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center flex-shrink-0 transition-colors duration-150"
            aria-hidden="true"
          >
            <component :is="lineIcon(line.icon)" class="h-3.5 w-3.5 text-slate-400 group-hover:text-[var(--landing-blue-500)] transition-colors" />
          </div>
          <span class="flex-1 text-sm font-medium text-slate-800 group-hover:text-slate-900 transition-colors">{{ line.name }}</span>
          <span class="landing-mono text-xs text-slate-400 tabular-nums flex-shrink-0 hidden sm:block">
            {{ line.productCount }}+ ref.
          </span>
          <ChevronRight class="h-4 w-4 text-slate-300 group-hover:text-[var(--landing-blue-500)] transition-colors flex-shrink-0" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <!-- ─────────────────── HVAC CALC BANNER ─────────────────── -->
    <section ref="calcSection" class="max-w-7xl mx-auto px-4 py-24 lg:py-28">
      <div class="relative bg-[var(--ink-900)] rounded-3xl overflow-hidden p-10 md:p-14">
        <div
          class="absolute inset-0 opacity-[0.07]"
          style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 24px 24px;"
          aria-hidden="true"
        />
        <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div class="text-center md:text-left">
            <div class="landing-mono inline-flex items-center gap-2 bg-white/[0.12] border border-white/[0.18] rounded-full px-4 py-1.5 text-white/90 text-xs mb-4">
              <Zap class="h-3.5 w-3.5 text-[var(--ember-500)]" aria-hidden="true" />
              Herramienta técnica gratuita
            </div>
            <h2 class="landing-serif text-3xl md:text-4xl font-semibold text-white mb-3 text-balance">
              Calculadora de Carga Térmica
            </h2>
            <p class="text-slate-300 text-base max-w-lg leading-relaxed text-pretty">
              Ingresa las dimensiones de tu espacio y obtén recomendaciones automáticas
              de compresores, válvulas y refrigerantes.
            </p>
          </div>
          <div class="flex flex-col gap-3 flex-shrink-0">
            <a
              :href="calculatorUrl"
              class="flex items-center gap-2 bg-[var(--ember-500)] hover:brightness-110 text-white font-semibold px-8 py-4 rounded-xl transition-[filter] text-base"
            >
              <Calculator class="h-5 w-5" aria-hidden="true" />
              Calcular ahora
            </a>
            <p class="text-xs text-center text-slate-400">Gratis · Sin registro</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ─────────────────── TRUST BAR ─────────────────── -->
    <section ref="trustSection" class="bg-white py-16 border-t border-slate-100">
      <div class="max-w-7xl mx-auto px-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
          <div v-for="b in benefits" :key="b.title" class="flex items-start gap-3">
            <div
              class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <component :is="b.icon" class="h-4 w-4 text-[var(--landing-blue-500)]" />
            </div>
            <div>
              <p class="text-sm font-semibold text-slate-900">{{ b.title }}</p>
              <p class="text-xs text-slate-500 mt-0.5 leading-relaxed">{{ b.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search, ArrowRight, ChevronRight, Zap, Calculator,
  Truck, ShieldCheck, Headphones, Award,
  Wrench, Settings2, Gauge, Filter, Thermometer, Layers, Cpu,
} from '@lucide/vue'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'
import { useLandingMotion } from '../composables/useLandingMotion'
import HeroBlueprint from '../components/HeroBlueprint.vue'
import '@fontsource/source-serif-4/600.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'

const router        = useRouter()
const catalogStore  = useCatalogStore()
const productLines  = catalogStore.productLines
const searchQuery   = ref('')
const calculatorUrl = import.meta.env.VITE_APP_URL_CALCULATOR ?? 'https://calculator.fsparts.org'

function handleSearch() {
  if (!searchQuery.value.trim()) return
  router.push({ path: '/catalog', query: { q: searchQuery.value } })
}

const ICON_MAP: Record<string, unknown> = { Wrench, Settings2, Gauge, Filter, Thermometer, Layers, Cpu }
function lineIcon(name: string) { return ICON_MAP[name] ?? Wrench }

const benefits = [
  { icon: Truck,        title: 'Envío rápido',        desc: 'Despacho mismo día en pedidos antes de las 2pm' },
  { icon: ShieldCheck,  title: 'Garantía total',       desc: 'Todos los productos son 100% originales y garantizados' },
  { icon: Headphones,   title: 'Soporte técnico',      desc: 'Asesoría especializada en refrigeración y HVAC' },
  { icon: Award,        title: 'Distribuidor oficial', desc: 'Distribuidor autorizado de las mejores marcas' },
]

// ─── Motion target refs ───
const heroBadge    = ref<HTMLElement | null>(null)
const heroTitle    = ref<HTMLElement | null>(null)
const heroSubtitle = ref<HTMLElement | null>(null)
const heroSearch   = ref<HTMLElement | null>(null)
const heroCta      = ref<HTMLElement | null>(null)
const heroLinks    = ref<HTMLElement | null>(null)
const heroStats    = ref<HTMLElement | null>(null)
const linesSection = ref<HTMLElement | null>(null)
const calcSection  = ref<HTMLElement | null>(null)
const trustSection = ref<HTMLElement | null>(null)

const countProducts = ref(0)
const countBrands   = ref(0)
const countYears    = ref(0)

useLandingMotion({
  heroBadge, heroTitle, heroSubtitle, heroSearch, heroCta, heroLinks, heroStats,
  linesSection, calcSection, trustSection,
  countProducts, countBrands, countYears,
})
</script>

<style scoped>
.landing-page {
  --ink-950: #060B18;
  --ink-900: #0B1226;
  --landing-blue-500: #395FC4;
  --landing-blue-300: #7C97D6;
  --ember-500: #E85D3D;
  font-family: 'IBM Plex Sans', sans-serif;
}
.landing-serif { font-family: 'Source Serif 4', serif; }
.landing-mono { font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.04em; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/shop -- LandingView`
Expected: PASS

- [ ] **Step 5: Run the full shop test suite**

Run: `npm run test --workspace=apps/shop`
Expected: PASS — including `App.test.ts`, which mounts the full `App.vue` (and therefore `LandingView` via the `/` route) and must still find "Shop" in the rendered text.

- [ ] **Step 6: Manual verification in the browser**

Run: `npm run dev:shop`, open the printed local URL.
Check:
- Hero loads with the badge → headline (line-by-line reveal) → subtitle → search → quick links → stats animating in, in that order.
- The blueprint schematic is visible behind the hero text on desktop (`md:` and up), hidden on mobile.
- An ember-colored dot travels along the connector line on a loop.
- Scrolling down reveals the product lines, calculator banner, and trust bar sections with a fade/slide-up.
- Hovering the search button and the quick-category links produces a subtle magnetic pull toward the cursor.
- In OS accessibility settings, enable "reduce motion," reload — hero and sections should appear instantly at full opacity with no animation, and the blueprint should render fully drawn with no moving dot.

- [ ] **Step 7: Commit**

```bash
git add apps/shop/src/modules/landing/views/LandingView.vue apps/shop/src/modules/landing/views/__tests__/LandingView.test.ts
git commit -m "feat(shop): redesign landing page with Midnight & Ember identity and GSAP motion"
```
