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
