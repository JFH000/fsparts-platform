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
    // Returns a stand-in Tween object (not undefined) so code that relies on gsap.to's
    // return value — e.g. onSplit returning it to SplitText for seamless re-split
    // handling — has something truthy to work with, matching the real API's contract.
    to: vi.fn(() => ({})),
    from: vi.fn(),
    timeline: vi.fn(() => {
      const tl = { to: vi.fn(() => tl) }
      return tl
    }),
    quickTo: vi.fn(() => vi.fn()),
  },
}))
vi.mock('gsap/ScrollTrigger', () => ({ ScrollTrigger: {} }))
vi.mock('gsap/SplitText', () => {
  // Mirrors real SplitText's constructor behavior closely enough for these tests: the
  // real class invokes `onSplit(this)` synchronously from its constructor on first split
  // (see gsap/SplitText.js), and again later whenever autoSplit re-splits (font load /
  // resize) — a call this suite doesn't need to simulate since it only asserts on the
  // initial wiring.
  class SplitText {
    static instances: SplitText[] = []
    lines: unknown[] = []
    revert = vi.fn()
    config: any
    onSplitResult: unknown

    constructor(_target: unknown, config: any) {
      this.config = config
      SplitText.instances.push(this)
      this.onSplitResult = config?.onSplit?.(this)
    }
  }
  return { SplitText }
})

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
  it('registers ScrollTrigger and SplitText at module load', () => {
    expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger, SplitText)
  })

  describe('runtime behavior', () => {
    beforeEach(() => vi.clearAllMocks())

    it('builds a GSAP context on mount and reverts it on unmount', () => {
      const wrapper = mountWithMotion()

      expect(gsap.context).toHaveBeenCalledTimes(1)

      const contextResult = (gsap.context as any).mock.results[0].value
      wrapper.unmount()

      expect(contextResult.revert).toHaveBeenCalledTimes(1)
    })

    it('splits the hero title with autoSplit and wires onSplit to build the line-reveal tween', () => {
      mountWithMotion()

      const instances = (SplitText as any).instances
      const instance = instances[instances.length - 1]

      // autoSplit + onSplit are what let SplitText re-split (and re-run onSplit) whenever
      // the H1's layout changes — e.g. a self-hosted webfont swapping in after a cold
      // cache — instead of freezing line boxes measured against the fallback font.
      expect(instance.config).toMatchObject({ type: 'lines', autoSplit: true })
      expect(typeof instance.config.onSplit).toBe('function')

      // The mock's constructor invokes onSplit synchronously (matching real SplitText's
      // behavior on first split), so by now the line-reveal animation should already be
      // built against this instance's `lines`.
      expect(gsap.set).toHaveBeenCalledWith(instance.lines, { yPercent: 100, autoAlpha: 0 })
      expect(gsap.to).toHaveBeenCalledWith(
        instance.lines,
        expect.objectContaining({ yPercent: 0, autoAlpha: 1, stagger: 0.08 }),
      )
      expect(instance.onSplitResult).toBeDefined()
    })
  })
})
