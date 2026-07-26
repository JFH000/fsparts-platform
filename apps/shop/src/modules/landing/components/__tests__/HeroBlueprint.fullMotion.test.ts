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
