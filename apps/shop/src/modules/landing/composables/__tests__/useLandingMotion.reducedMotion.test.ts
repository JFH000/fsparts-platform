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
