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
        // autoSplit + onSplit (GSAP 3.13+): SplitText re-splits itself whenever the H1's
        // layout changes — including the self-hosted Source Serif 4 webfont swapping in
        // after a cold-cache first paint — and re-invokes onSplit each time. Building the
        // line-reveal tween inside onSplit (instead of splitting once, synchronously, at
        // mount) means a font-swap mid-reveal re-splits into freshly-measured line boxes
        // and seamlessly resumes the reveal, rather than freezing stale line wrappers that
        // then wrap again internally once the wider font metrics land.
        new SplitText(targets.heroTitle.value, {
          type: 'lines',
          autoSplit: true,
          onSplit(self) {
            gsap.set(self.lines, { yPercent: 100, autoAlpha: 0 })
            return gsap.to(self.lines, {
              yPercent: 0,
              autoAlpha: 1,
              stagger: 0.08,
              ease: 'power3.out',
              duration: 0.65,
              delay: 0.1,
            })
          },
        })
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
