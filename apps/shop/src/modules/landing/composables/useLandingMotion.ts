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
