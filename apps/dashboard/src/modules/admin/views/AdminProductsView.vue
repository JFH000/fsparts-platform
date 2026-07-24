<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Productos</h1>
        <p class="text-sm text-slate-500 mt-0.5">{{ products.length }} productos publicados</p>
      </div>
      <RouterLink
        to="/products/new"
        class="flex items-center gap-2 bg-brand-700 hover:bg-brand-800 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-sm"
      >
        <Plus class="h-4 w-4" />
        Nuevo producto
      </RouterLink>
    </div>

    <!-- Error -->
    <div v-if="loadError" class="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
      {{ loadError }}
    </div>

    <!-- Table -->
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-slate-100">
            <th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-5 py-3.5">Producto</th>
            <th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5">Línea</th>
            <th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5">Precio</th>
            <th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5">Stock</th>
            <th class="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 py-3.5">Estado</th>
            <th class="px-4 py-3.5" />
          </tr>
        </thead>
        <tbody>
          <!-- Loading skeleton -->
          <template v-if="isLoading">
            <tr v-for="i in 5" :key="i" class="border-b border-slate-50 last:border-0">
              <td class="px-5 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="h-10 w-10 rounded-lg bg-slate-100 animate-pulse flex-shrink-0" />
                  <div class="space-y-1.5">
                    <div class="h-3 w-36 bg-slate-100 rounded animate-pulse" />
                    <div class="h-2.5 w-24 bg-slate-50 rounded animate-pulse" />
                  </div>
                </div>
              </td>
              <td class="px-4 py-3.5"><div class="h-5 w-12 bg-slate-100 rounded-full animate-pulse" /></td>
              <td class="px-4 py-3.5"><div class="h-3 w-16 bg-slate-100 rounded animate-pulse" /></td>
              <td class="px-4 py-3.5"><div class="h-3 w-8 bg-slate-100 rounded animate-pulse" /></td>
              <td class="px-4 py-3.5"><div class="h-5 w-20 bg-slate-100 rounded-full animate-pulse" /></td>
              <td class="px-4 py-3.5"><div class="h-7 w-20 bg-slate-100 rounded-lg animate-pulse" /></td>
            </tr>
          </template>

          <!-- Empty state -->
          <tr v-else-if="!products.length">
            <td colspan="6" class="px-5 py-16 text-center">
              <Package class="h-10 w-10 text-slate-200 mx-auto mb-3" />
              <p class="text-sm font-medium text-slate-400">No hay productos publicados</p>
              <p class="text-xs text-slate-300 mt-1">Crea tu primer producto para empezar.</p>
            </td>
          </tr>

          <!-- Rows -->
          <tr
            v-for="p in products"
            :key="p.id"
            class="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors"
          >
            <!-- Producto -->
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <div class="h-10 w-10 rounded-lg bg-white border border-slate-100 overflow-hidden flex-shrink-0">
                  <img
                    v-if="p.images?.[0]"
                    :src="p.images[0]"
                    :alt="p.name"
                    class="h-full w-full object-contain p-0.5"
                  />
                  <div v-else class="h-full w-full flex items-center justify-center">
                    <ImageOff class="h-4 w-4 text-slate-300" />
                  </div>
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-slate-800 truncate max-w-[220px]">{{ p.name }}</p>
                  <p class="text-xs text-slate-400 font-mono">{{ p.sku }}</p>
                </div>
              </div>
            </td>

            <!-- Línea -->
            <td class="px-4 py-3.5">
              <span v-if="p.product_line" class="inline-flex items-center bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-full">
                {{ p.product_line.code }}
              </span>
              <span v-else class="text-slate-300 text-xs">—</span>
            </td>

            <!-- Precio -->
            <td class="px-4 py-3.5">
              <span v-if="p.price_cop != null" class="text-sm font-semibold text-slate-700">${{ p.price_cop.toFixed(2) }} <span class="text-xs text-slate-400 font-normal">COP</span></span>
              <span v-else-if="p.price_usd != null" class="text-sm font-semibold text-slate-700">${{ p.price_usd.toFixed(2) }} <span class="text-xs text-slate-400 font-normal">USD</span></span>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>

            <!-- Stock -->
            <td class="px-4 py-3.5">
              <span
                class="text-sm font-semibold"
                :class="{
                  'text-emerald-600': p.stock > 10,
                  'text-amber-500':  p.stock > 0 && p.stock <= 10,
                  'text-red-500':    p.stock === 0,
                }"
              >{{ p.stock }}</span>
            </td>

            <!-- Estado -->
            <td class="px-4 py-3.5">
              <div class="flex flex-wrap gap-1">
                <span v-if="p.is_featured" class="inline-flex items-center gap-1 bg-accent-50 text-accent-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-accent-200">
                  <Star class="h-2.5 w-2.5" /> Destacado
                </span>
                <span v-if="p.is_new" class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                  Nuevo
                </span>
              </div>
            </td>

            <!-- Acciones -->
            <td class="px-4 py-3.5">
              <div v-if="confirmDeleteId === p.id" class="flex items-center gap-2">
                <span class="text-xs text-red-500 font-medium">¿Eliminar?</span>
                <button @click="confirmDelete(p.id)" class="text-xs font-semibold text-red-600 hover:text-red-700 transition-colors">Sí</button>
                <button @click="confirmDeleteId = null" class="text-xs text-slate-400 hover:text-slate-600 transition-colors">No</button>
              </div>
              <div v-else class="flex items-center gap-2">
                <RouterLink
                  :to="`/products/${p.id}/edit`"
                  class="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-brand-700 bg-slate-100 hover:bg-brand-50 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  <Pencil class="h-3 w-3" /> Editar
                </RouterLink>
                <button
                  @click="confirmDeleteId = p.id"
                  class="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 bg-slate-100 hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  <Trash2 class="h-3 w-3" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Package, Pencil, Trash2, Star, ImageOff } from '@lucide/vue'
import { listAdminProducts, deleteProduct, type AdminProductRow } from '../services/admin.service'

const products       = ref<AdminProductRow[]>([])
const isLoading      = ref(true)
const loadError      = ref('')
const confirmDeleteId = ref<string | null>(null)

onMounted(load)

async function load() {
  isLoading.value = true
  loadError.value = ''
  try {
    products.value = await listAdminProducts()
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Error cargando productos'
  } finally {
    isLoading.value = false
  }
}

async function confirmDelete(id: string) {
  try {
    await deleteProduct(id)
    products.value = products.value.filter(p => p.id !== id)
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : 'Error al eliminar'
  } finally {
    confirmDeleteId.value = null
  }
}
</script>
