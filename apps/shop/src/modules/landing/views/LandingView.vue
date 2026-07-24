<template>
  <div>
    <!-- ─────────────────── HERO ─────────────────── -->
    <section class="relative bg-slate-900 overflow-hidden">
      <!-- Dot grid -->
      <div
        class="absolute inset-0 opacity-[0.10]"
        style="background-image: radial-gradient(circle, #60a5fa 1px, transparent 1px); background-size: 40px 40px;"
        aria-hidden="true"
      />
      <!-- Gradient overlay -->
      <div class="absolute inset-0 bg-gradient-to-br from-brand-950/75 via-slate-900/50 to-slate-900" aria-hidden="true" />

      <div class="relative z-10 max-w-7xl mx-auto px-4 pt-24 pb-20 flex flex-col items-center text-center">

        <!-- Availability indicator -->
        <div class="hero-entrance hero-delay-1 inline-flex items-center gap-2 bg-white/[0.07] border border-white/[0.12] rounded-full px-4 py-1.5 text-slate-300 text-xs font-medium mb-8">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true"></span>
          Distribución especializada · HVAC/R industrial y comercial
        </div>

        <h1 class="hero-entrance hero-delay-2 text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.05] tracking-tight mb-6 max-w-4xl text-balance">
          Tu distribuidor
          <span class="text-brand-300"> HVAC/R</span>
          <span class="text-white"> de confianza</span>
        </h1>

        <p class="hero-entrance hero-delay-3 text-lg text-slate-300 mb-10 max-w-2xl leading-relaxed text-pretty">
          Compresores, válvulas, refrigerantes, filtros e intercambiadores de calor.
          Todo para refrigeración y aire acondicionado industrial y comercial.
        </p>

        <!-- Search bar -->
        <form @submit.prevent="handleSearch" class="hero-entrance hero-delay-4 flex gap-0 w-full max-w-2xl mb-8">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar por nombre, SKU o marca..."
            aria-label="Buscar productos"
            class="flex-1 px-6 py-4 text-base rounded-l-full border-0 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-xl"
          />
          <button
            type="submit"
            class="bg-accent-500 hover:bg-accent-600 text-white px-7 py-4 rounded-r-full font-semibold text-base transition-colors shadow-xl flex items-center gap-2"
          >
            <Search class="h-5 w-5" aria-hidden="true" />
            Buscar
          </button>
        </form>

        <!-- Quick category links -->
        <div class="hero-entrance hero-delay-5 flex flex-wrap justify-center gap-2 mb-14">
          <RouterLink
            v-for="line in productLines.slice(0, 5)"
            :key="line.id"
            :to="`/catalog?line=${line.code}`"
            class="flex items-center gap-1.5 bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.13] text-slate-300 hover:text-white text-xs px-4 py-2 rounded-full transition-all duration-150"
          >
            <component :is="lineIcon(line.icon)" class="h-3.5 w-3.5 text-brand-400" aria-hidden="true" />
            {{ line.name.split(' ')[0] }}
          </RouterLink>
          <RouterLink
            to="/catalog"
            class="flex items-center gap-1 bg-accent-500/20 hover:bg-accent-500/35 border border-accent-400/40 text-white font-semibold text-xs px-4 py-2 rounded-full transition-all duration-150"
          >
            Ver todo <ArrowRight class="h-3.5 w-3.5" aria-hidden="true" />
          </RouterLink>
        </div>

        <!-- Inline trust strip — replaces the hero-metric stat block -->
        <div
          ref="statsRef"
          class="hero-entrance hero-delay-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-2 text-sm"
        >
          <span class="text-slate-400">
            <span class="text-white font-bold tabular-nums">{{ statsStarted ? displayProducts : '5.000' }}+</span>
            <span class="ml-1">referencias en stock</span>
          </span>
          <span class="text-slate-700 hidden sm:block" aria-hidden="true">·</span>
          <span class="text-slate-400">
            <span class="text-white font-bold tabular-nums">{{ statsStarted ? displayBrands : '50' }}+</span>
            <span class="ml-1">marcas</span>
          </span>
          <span class="text-slate-700 hidden sm:block" aria-hidden="true">·</span>
          <span class="text-slate-400">
            <span class="text-white font-bold tabular-nums">{{ statsStarted ? displayYears : '15' }}</span>
            <span class="ml-1">años distribuyendo</span>
          </span>
        </div>
      </div>

      <!-- Bottom fade to body -->
      <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-50 to-transparent" aria-hidden="true" />
    </section>

    <!-- ─────────────────── PRODUCT LINES — directory ─────────────────── -->
    <section
      ref="linesRef"
      class="max-w-7xl mx-auto px-4 py-16 sr-section"
      :class="linesVisible ? 'sr-active' : linesReady ? 'sr-pending' : ''"
    >
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="text-2xl font-bold text-slate-900 text-balance">Líneas de Producto</h2>
        <RouterLink
          to="/catalog"
          class="text-sm font-medium text-brand-700 hover:text-brand-800 flex items-center gap-1 transition-colors"
        >
          Ver catálogo completo <ArrowRight class="h-4 w-4" aria-hidden="true" />
        </RouterLink>
      </div>

      <!-- Catalog directory list -->
      <div class="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
        <RouterLink
          v-for="line in productLines"
          :key="line.id"
          :to="`/catalog?line=${line.code}`"
          class="group flex items-center gap-3 px-5 py-3.5 bg-white hover:bg-brand-50/60 transition-colors duration-150"
        >
          <!-- Line code — primary identifier -->
          <span class="font-mono text-sm font-bold text-brand-700 w-10 flex-shrink-0 tracking-wide">
            {{ line.code }}
          </span>
          <!-- Icon — secondary, compact -->
          <div
            class="w-6 h-6 rounded bg-slate-100 group-hover:bg-brand-100 flex items-center justify-center flex-shrink-0 transition-colors duration-150"
            aria-hidden="true"
          >
            <component :is="lineIcon(line.icon)" class="h-3.5 w-3.5 text-slate-400 group-hover:text-brand-600 transition-colors" />
          </div>
          <!-- Name -->
          <span class="flex-1 text-sm font-medium text-slate-800 group-hover:text-slate-900 transition-colors">{{ line.name }}</span>
          <!-- Count -->
          <span class="text-xs text-slate-400 font-mono tabular-nums flex-shrink-0 hidden sm:block">
            {{ line.productCount }}+ ref.
          </span>
          <!-- Chevron -->
          <ChevronRight class="h-4 w-4 text-slate-300 group-hover:text-brand-400 transition-colors flex-shrink-0" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <!-- ─────────────────── HVAC CALC BANNER ─────────────────── -->
    <section
      ref="calcRef"
      class="max-w-7xl mx-auto px-4 py-16 sr-section"
      :class="calcVisible ? 'sr-active' : calcReady ? 'sr-pending' : ''"
    >
      <div class="relative bg-gradient-to-r from-brand-800 to-brand-900 rounded-3xl overflow-hidden p-10 md:p-14">
        <div
          class="absolute inset-0 opacity-[0.07]"
          style="background-image: radial-gradient(circle, white 1px, transparent 1px); background-size: 24px 24px;"
          aria-hidden="true"
        />
        <div class="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div class="text-center md:text-left">
            <div class="inline-flex items-center gap-2 bg-white/[0.12] border border-white/[0.18] rounded-full px-4 py-1.5 text-white/90 text-xs font-medium mb-4">
              <Zap class="h-3.5 w-3.5 text-accent-400" aria-hidden="true" />
              Herramienta técnica gratuita
            </div>
            <h2 class="text-3xl md:text-4xl font-bold text-white mb-3 text-balance">
              Calculadora de Carga Térmica
            </h2>
            <p class="text-slate-300 text-base max-w-lg leading-relaxed text-pretty">
              Ingresa las dimensiones de tu espacio y obtén recomendaciones automáticas
              de compresores, válvulas y refrigerantes.
            </p>
          </div>
          <div class="flex flex-col gap-3 flex-shrink-0">
            <RouterLink
              to="/hvac-calculator"
              class="flex items-center gap-2 bg-accent-500 hover:bg-accent-600 text-white font-semibold px-8 py-4 rounded-xl transition-colors text-base"
            >
              <Calculator class="h-5 w-5" aria-hidden="true" />
              Calcular ahora
            </RouterLink>
            <p class="text-xs text-center text-slate-400">Gratis · Sin registro</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ─────────────────── TRUST BAR ─────────────────── -->
    <section
      ref="trustRef"
      class="bg-white py-12 border-t border-slate-100 sr-section"
      :class="trustVisible ? 'sr-active' : trustReady ? 'sr-pending' : ''"
    >
      <div class="max-w-7xl mx-auto px-4">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-6">
          <div v-for="b in benefits" :key="b.title" class="flex items-start gap-3">
            <div
              class="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 mt-0.5"
              aria-hidden="true"
            >
              <component :is="b.icon" class="h-4 w-4 text-brand-700" />
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
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search, ArrowRight, ChevronRight, Zap, Calculator,
  Truck, ShieldCheck, Headphones, Award,
  Wrench, Settings2, Gauge, Filter, Thermometer, Layers, Cpu,
} from '@lucide/vue'
import { useCatalogStore } from '@/modules/catalog/stores/catalog.store'

const router       = useRouter()
const catalogStore = useCatalogStore()
const productLines = catalogStore.productLines
const searchQuery  = ref('')

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

// ─── Count-up animation for inline trust strip ───
const statsRef     = ref<HTMLElement | null>(null)
const statsStarted = ref(false)
const countProducts = ref(0)
const countBrands   = ref(0)
const countYears    = ref(0)

const displayProducts = computed(() => countProducts.value.toLocaleString('es-CO'))
const displayBrands   = computed(() => countBrands.value.toString())
const displayYears    = computed(() => countYears.value.toString())

function animateCount(target: { value: number }, end: number, duration: number) {
  const start = performance.now()
  function step(now: number) {
    const elapsed  = now - start
    const progress = Math.min(elapsed / duration, 1)
    const ease     = 1 - Math.pow(1 - progress, 3)
    target.value   = Math.round((end - 0) * ease)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

// ─── Scroll-reveal state ───
const linesRef    = ref<HTMLElement | null>(null)
const calcRef     = ref<HTMLElement | null>(null)
const trustRef    = ref<HTMLElement | null>(null)

const linesReady    = ref(false)
const calcReady     = ref(false)
const trustReady    = ref(false)

const linesVisible    = ref(false)
const calcVisible     = ref(false)
const trustVisible    = ref(false)

function makeRevealObserver(visibleRef: { value: boolean }) {
  return new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting) visibleRef.value = true
    },
    { threshold: 0.08 },
  )
}

let statsObserver: IntersectionObserver | null = null
const revealObservers: IntersectionObserver[] = []

onMounted(async () => {
  // Wait one tick so elements are painted before we hide them
  await nextTick()

  // Stats count-up
  statsObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !statsStarted.value) {
        statsStarted.value = true
        animateCount(countProducts, 5000, 1800)
        animateCount(countBrands,   50,   1400)
        animateCount(countYears,    15,   1200)
        statsObserver?.disconnect()
      }
    },
    { threshold: 0.5 },
  )
  if (statsRef.value) statsObserver.observe(statsRef.value)

  // Scroll-reveal sections — set ready after paint so default visible state is established
  const reveals = [
    { ref: linesRef, ready: linesReady, visible: linesVisible },
    { ref: calcRef,  ready: calcReady,  visible: calcVisible },
    { ref: trustRef, ready: trustReady, visible: trustVisible },
  ]

  for (const item of reveals) {
    item.ready.value = true  // enables sr-pending (hides below-fold elements)
    const obs = makeRevealObserver(item.visible)
    if (item.ref.value) obs.observe(item.ref.value)
    revealObservers.push(obs)
  }
})

onUnmounted(() => {
  statsObserver?.disconnect()
  revealObservers.forEach(o => o.disconnect())
})
</script>

<style scoped>
/* ─── Hero entrance animations ─── */
.hero-entrance {
  animation: heroIn 0.65s cubic-bezier(0.33, 1, 0.68, 1) both;
}
.hero-delay-1 { animation-delay: 0.05s; }
.hero-delay-2 { animation-delay: 0.15s; }
.hero-delay-3 { animation-delay: 0.28s; }
.hero-delay-4 { animation-delay: 0.42s; }
.hero-delay-5 { animation-delay: 0.54s; }
.hero-delay-6 { animation-delay: 0.64s; }

@keyframes heroIn {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: none; }
}

/* ─── Scroll-reveal sections ─── */
/* sr-pending is only set after mount, so SSR/noscript sees content normally */
.sr-pending {
  opacity: 0;
  transform: translateY(20px);
}
.sr-active {
  transition: opacity 0.6s cubic-bezier(0.33, 1, 0.68, 1),
              transform 0.6s cubic-bezier(0.33, 1, 0.68, 1);
  opacity: 1;
  transform: none;
}

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  .hero-entrance { animation: none; }
  .sr-pending    { opacity: 1; transform: none; }
  .sr-active     { transition: none; }
}
</style>
