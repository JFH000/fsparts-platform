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
