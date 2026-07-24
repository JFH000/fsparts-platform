<template>
  <aside class="w-full">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-bold text-slate-900 flex items-center gap-2">
        <SlidersHorizontal class="h-4 w-4 text-brand-600" />
        Filtros
        <span v-if="store.activeFilterCount > 0" class="bg-brand-600 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">
          {{ store.activeFilterCount }}
        </span>
      </h2>
      <button
        v-if="store.activeFilterCount > 0"
        @click="store.resetFilters()"
        class="text-xs text-red-500 hover:text-red-700 font-medium"
      >
        Limpiar todo
      </button>
    </div>

    <!-- In stock only -->
    <div class="mb-5 pb-5 border-b border-slate-100">
      <div class="flex items-center gap-2.5">
        <button
          type="button"
          role="switch"
          :aria-checked="store.filters.inStockOnly"
          @click="store.filters.inStockOnly = !store.filters.inStockOnly"
          :class="[
            'w-10 h-5 rounded-full transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            store.filters.inStockOnly ? 'bg-brand-600' : 'bg-slate-200',
          ]"
        >
          <div :class="[
            'w-4 h-4 bg-white rounded-full m-0.5 shadow transition-transform pointer-events-none',
            store.filters.inStockOnly ? 'translate-x-5' : 'translate-x-0',
          ]" aria-hidden="true" />
        </button>
        <span
          class="text-sm text-slate-700 cursor-pointer select-none hover:text-slate-900"
          @click="store.filters.inStockOnly = !store.filters.inStockOnly"
        >Solo con stock</span>
      </div>
    </div>

    <!-- Product Lines -->
    <FilterSection title="Línea de Producto" :count="store.filters.productLineIds.length">
      <label
        v-for="line in store.productLines"
        :key="line.id"
        class="flex items-center gap-2.5 py-1.5 cursor-pointer group"
      >
        <input
          type="checkbox"
          :checked="store.filters.productLineIds.includes(line.id)"
          @change="store.toggleProductLine(line.id)"
          class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span class="text-sm text-slate-700 group-hover:text-slate-900 flex-1">{{ line.name }}</span>
        <span class="text-xs text-slate-400">{{ line.productCount }}</span>
      </label>
    </FilterSection>

    <!-- Brands -->
    <FilterSection title="Marca" :count="store.filters.brandIds.length">
      <label
        v-for="brand in store.brands"
        :key="brand.id"
        class="flex items-center gap-2.5 py-1.5 cursor-pointer group"
      >
        <input
          type="checkbox"
          :checked="store.filters.brandIds.includes(brand.id)"
          @change="store.toggleBrand(brand.id)"
          class="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        <span class="text-sm text-slate-700 group-hover:text-slate-900 flex-1">{{ brand.name }}</span>
        <span class="text-xs text-slate-400">{{ brand.country }}</span>
      </label>
    </FilterSection>

    <!-- Price range (only when products have real prices) -->
    <FilterSection v-if="store.maxPrice > 0" title="Precio" :count="0">
      <div class="px-1">
        <input
          type="range"
          :min="0"
          :max="store.maxPrice"
          :value="store.filters.priceRange[1]"
          @input="(e) => store.filters.priceRange = [0, Number((e.target as HTMLInputElement).value)]"
          class="w-full accent-brand-600"
        />
        <div class="flex justify-between text-xs text-slate-500 mt-1">
          <span>$0</span>
          <span class="font-semibold text-slate-700">Hasta {{ formatCurrency(store.filters.priceRange[1]) }}</span>
        </div>
      </div>
    </FilterSection>

    <!-- Refrigerants -->
    <FilterSection title="Refrigerante compatible" :count="store.filters.refrigerants.length">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="r in store.refrigerants"
          :key="r"
          @click="store.toggleRefrigerant(r)"
          :class="[
            'text-xs px-2.5 py-1 rounded-full border transition-all font-medium',
            store.filters.refrigerants.includes(r)
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700',
          ]"
        >
          {{ r }}
        </button>
      </div>
    </FilterSection>
  </aside>
</template>

<script setup lang="ts">
import { SlidersHorizontal } from '@lucide/vue'
import { useCatalogStore } from '../stores/catalog.store'
import { formatCurrency } from '@fsparts/core'
import FilterSection from './FilterSection.vue'

const store = useCatalogStore()
</script>
