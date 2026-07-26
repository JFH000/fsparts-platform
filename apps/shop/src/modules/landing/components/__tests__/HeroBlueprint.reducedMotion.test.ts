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
