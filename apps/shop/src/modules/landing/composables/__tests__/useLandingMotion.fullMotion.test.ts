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
  SplitText: class {
    lines = []
    revert = vi.fn()
  },
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
  })
})
