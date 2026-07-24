<template>
  <div class="max-w-7xl mx-auto px-4 py-8">
    <!-- Breadcrumb + title -->
    <div class="mb-6">
      <nav class="flex items-center gap-2 text-xs text-slate-400 mb-2" aria-label="Navegación">
        <RouterLink to="/" class="hover:text-brand-600">Inicio</RouterLink>
        <ChevronRight class="h-3 w-3" aria-hidden="true" />
        <span class="text-slate-700 font-medium" :aria-current="activeLineName ? undefined : 'page'">Catálogo</span>
        <template v-if="activeLineName">
          <ChevronRight class="h-3 w-3" aria-hidden="true" />
          <span class="text-slate-700" aria-current="page">{{ activeLineName }}</span>
        </template>
      </nav>
      <h1 class="text-2xl font-bold text-slate-900 text-balance">{{ pageTitle }}</h1>
      <p class="text-slate-500 text-sm mt-1">{{ store.filteredProducts.length }} resultados encontrados</p>
    </div>

    <div class="flex gap-8">
      <!-- Filter sidebar (desktop) -->
      <div class="hidden lg:block w-64 flex-shrink-0">
        <div class="sticky top-24 flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden max-h-[calc(100vh-7rem)]">
          <div class="overflow-y-auto overscroll-contain p-5 flex-1 scrollbar-thin">
            <FilterSidebar />
          </div>
        </div>
      </div>

      <!-- Main content -->
      <div class="flex-1 min-w-0">
        <!-- Sort bar -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-5 bg-white rounded-xl border border-slate-100 px-4 py-3 shadow-sm">
          <!-- Mobile filter toggle -->
          <button
            @click="showMobileFilters = true"
            class="lg:hidden flex items-center gap-2 text-sm font-medium text-slate-700 border border-slate-200 px-3 py-1.5 rounded-lg"
          >
            <SlidersHorizontal class="h-4 w-4" />
            Filtros
            <span v-if="store.activeFilterCount" class="bg-brand-600 text-white text-[10px] rounded-full px-1.5">{{ store.activeFilterCount }}</span>
          </button>

          <!-- Active filters chips -->
          <div class="flex flex-wrap gap-2 flex-1" role="list" aria-label="Filtros activos">
            <span
              v-for="chip in activeChips"
              :key="chip.label"
              class="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2.5 py-1 rounded-full"
              role="listitem"
            >
              {{ chip.label }}
              <button
                @click="chip.remove()"
                :aria-label="`Quitar filtro: ${chip.label}`"
                class="hover:text-red-500 ml-0.5 focus-visible:outline-2 focus-visible:outline-red-400 rounded"
              >
                <X class="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          </div>

          <!-- Sort -->
          <div class="flex items-center gap-2 text-sm text-slate-600">
            <ArrowUpDown class="h-4 w-4" />
            <select
              v-model="store.sortBy"
              aria-label="Ordenar resultados"
              class="border-0 text-sm text-slate-700 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 cursor-pointer bg-transparent rounded"
            >
              <option value="relevance">Relevancia</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="name-asc">Nombre A–Z</option>
              <option value="newest">Novedades</option>
            </select>
          </div>
        </div>

        <!-- Results grid -->
        <div v-if="store.filteredProducts.length > 0" class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          <ProductCard
            v-for="product in store.paginatedProducts"
            :key="product.id"
            :product="product"
          />
        </div>

        <!-- Empty state -->
        <div v-else class="flex flex-col items-center justify-center py-24 text-center">
          <div class="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
            <PackageSearch class="h-7 w-7 text-slate-400" aria-hidden="true" />
          </div>
          <h3 class="text-lg font-semibold text-slate-700 mb-1.5">No se encontraron productos</h3>
          <p class="text-slate-400 text-sm mb-6 text-pretty max-w-xs">Intenta con otros términos o ajusta los filtros activos</p>
          <button
            @click="store.resetFilters()"
            class="bg-brand-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Limpiar filtros
          </button>
        </div>

        <!-- Pagination -->
        <div v-if="store.totalPages > 1" class="mt-8 flex flex-col items-center gap-3">
          <!-- Info -->
          <p class="text-xs text-slate-400">
            Mostrando
            {{ (store.currentPage - 1) * store.pageSize + 1 }}–{{ Math.min(store.currentPage * store.pageSize, store.filteredProducts.length) }}
            de {{ store.filteredProducts.length }} productos
          </p>

          <!-- Controls -->
          <div class="flex items-center gap-1">
            <!-- Prev -->
            <button
              @click="store.setPage(store.currentPage - 1)"
              :disabled="store.currentPage === 1"
              class="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft class="h-4 w-4" /> Anterior
            </button>

            <!-- Page numbers -->
            <template v-for="page in pageNumbers" :key="page">
              <span v-if="page === '...'" class="px-2 text-slate-400 text-sm select-none">…</span>
              <button
                v-else
                @click="store.setPage(page as number)"
                :class="[
                  'w-9 h-9 text-sm rounded-lg border transition-colors font-medium',
                  store.currentPage === page
                    ? 'bg-brand-700 border-brand-700 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                ]"
              >
                {{ page }}
              </button>
            </template>

            <!-- Next -->
            <button
              @click="store.setPage(store.currentPage + 1)"
              :disabled="store.currentPage === store.totalPages"
              class="flex items-center gap-1 px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente <ChevronRight class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Mobile filter drawer -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showMobileFilters" class="fixed inset-0 bg-black/50 z-50 lg:hidden" @click="showMobileFilters = false" />
      </Transition>
      <Transition name="slide-right">
        <div
          v-if="showMobileFilters"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filters-title"
          class="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl overflow-y-auto p-5 lg:hidden"
        >
          <div class="flex items-center justify-between mb-5">
            <h2 id="mobile-filters-title" class="font-bold text-slate-900">Filtros</h2>
            <button
              @click="showMobileFilters = false"
              aria-label="Cerrar filtros"
              class="text-slate-400 hover:text-slate-700 p-1 rounded-lg focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <FilterSidebar />
          <button
            @click="showMobileFilters = false"
            class="w-full mt-4 bg-brand-700 text-white py-3 rounded-xl font-semibold hover:bg-brand-800 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            Ver {{ store.filteredProducts.length }} resultados
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, ChevronLeft, SlidersHorizontal, ArrowUpDown, X, PackageSearch } from '@lucide/vue'
import { useCatalogStore } from '../stores/catalog.store'
import ProductCard from '../components/ProductCard.vue'
import FilterSidebar from '../components/FilterSidebar.vue'

const store = useCatalogStore()
const route = useRoute()
const showMobileFilters = ref(false)

// Sync URL query params to store
onMounted(() => applyQueryParams())
watch(() => route.query, applyQueryParams)

function applyQueryParams() {
  const q    = route.query.q as string | undefined
  const line = route.query.line as string | undefined

  if (q)    { store.searchInput = q; store.filters.search = q }
  if (line) {
    const found = store.productLines.find(l => l.code === line)
    if (found && !store.filters.productLineIds.includes(found.id)) {
      store.filters.productLineIds = [found.id]
    }
  }
}

const activeLineName = computed(() => {
  if (!store.filters.productLineIds.length) return ''
  const line = store.productLines.find(l => store.filters.productLineIds.includes(l.id))
  return line?.name ?? ''
})

const pageTitle = computed(() =>
  store.filters.search
    ? `Resultados para "${store.filters.search}"`
    : activeLineName.value || 'Catálogo de Productos'
)

// Build the page number list with ellipsis for large ranges
const pageNumbers = computed(() => {
  const total   = store.totalPages
  const current = store.currentPage
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | '...')[] = [1]
  if (current > 3)          pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2)  pages.push('...')
  pages.push(total)
  return pages
})

const activeChips = computed(() => {
  const chips: { label: string; remove: () => void }[] = []
  if (store.filters.search) chips.push({ label: `"${store.filters.search}"`, remove: () => { store.filters.search = ''; store.searchInput = '' } })
  store.filters.productLineIds.forEach(id => {
    const line = store.productLines.find(l => l.id === id)
    if (line) chips.push({ label: line.code, remove: () => store.toggleProductLine(id) })
  })
  store.filters.brandIds.forEach(id => {
    const brand = store.brands.find(b => b.id === id)
    if (brand) chips.push({ label: brand.name, remove: () => store.toggleBrand(id) })
  })
  store.filters.refrigerants.forEach(r => {
    chips.push({ label: r, remove: () => store.toggleRefrigerant(r) })
  })
  return chips
})
</script>
