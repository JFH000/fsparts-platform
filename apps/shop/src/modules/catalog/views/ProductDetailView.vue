<template>
  <div class="max-w-7xl mx-auto px-4 pt-4 pb-8">

    <!-- Not found -->
    <div v-if="!product" class="text-center py-20">
      <div class="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center mb-4 mx-auto">
        <PackageSearch class="h-7 w-7 text-slate-400" aria-hidden="true" />
      </div>
      <h2 class="text-lg font-semibold text-slate-700 mb-1">Producto no encontrado</h2>
      <p class="text-sm text-slate-400 mb-5">El producto que buscas no existe o fue removido del catálogo.</p>
      <RouterLink to="/catalog" class="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 border border-brand-200 px-4 py-2 rounded-lg hover:bg-brand-50 transition-colors">
        <ArrowLeft class="h-4 w-4" aria-hidden="true" /> Volver al catálogo
      </RouterLink>
    </div>

    <template v-else>
      <!-- Admin edit shortcut -->
      <RouterLink
        v-if="auth.isAdmin"
        :to="`/admin/products/${route.params.id}/edit`"
        title="Editar producto"
        class="fixed bottom-6 left-6 z-50 flex items-center justify-center w-10 h-10 bg-slate-900 hover:bg-slate-700 text-white rounded-xl shadow-lg transition-colors"
      >
        <Pencil class="h-4 w-4" />
      </RouterLink>

      <!-- Breadcrumb -->
      <nav class="flex items-center gap-1.5 text-xs text-slate-400 mb-5" aria-label="Navegación">
        <RouterLink to="/" class="hover:text-brand-600 transition-colors">Inicio</RouterLink>
        <ChevronRight class="h-3 w-3" aria-hidden="true" />
        <RouterLink to="/catalog" class="hover:text-brand-600 transition-colors">Catálogo</RouterLink>
        <ChevronRight class="h-3 w-3" aria-hidden="true" />
        <RouterLink :to="`/catalog?line=${product.productLine.code}`" class="hover:text-brand-600 transition-colors">{{ product.productLine.name }}</RouterLink>
        <ChevronRight class="h-3 w-3" aria-hidden="true" />
        <span class="text-slate-600 font-medium truncate max-w-xs" aria-current="page">{{ product.name }}</span>
      </nav>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">

        <!-- ── LEFT: Image gallery ── -->
        <div class="lg:sticky lg:top-24">
          <div class="relative bg-white rounded-2xl overflow-hidden aspect-square mb-3 border border-slate-100">
            <Transition name="img-fade" mode="out-in">
              <img
                v-if="currentImage"
                :key="activeImage"
                :src="currentImage"
                :alt="product.name"
                class="w-full h-full object-contain p-6"
                @error="activeImage = -1"
              />
              <div v-else :key="'fallback'" class="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-300">
                <PackageSearch class="h-16 w-16" />
                <span class="text-sm">Sin imagen</span>
              </div>
            </Transition>

            <div class="absolute top-3 left-3 flex flex-col gap-1.5">
              <AppBadge v-if="product.isNew" variant="orange">NUEVO</AppBadge>
            </div>

            <div
              v-if="displayImages.length > 1"
              class="absolute bottom-3 right-3 bg-slate-900/50 text-white font-mono text-[10px] leading-none px-2 py-1 rounded-full"
            >{{ activeImage + 1 }}/{{ displayImages.length }}</div>
          </div>

          <div v-if="displayImages.length > 1" class="flex items-center gap-2">
            <button
              v-for="(img, i) in displayImages"
              :key="i"
              @click="selectImage(i)"
              :class="[
                'w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0',
                activeImage === i ? 'border-brand-600' : 'border-slate-100 hover:border-slate-300',
              ]"
            >
              <img :src="img" :alt="product.name" class="w-full h-full object-contain p-1" />
            </button>
            <button
              @click="toggleSlideshow"
              class="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              :title="isPlaying ? 'Pausar presentación' : 'Iniciar presentación'"
            >
              <Pause v-if="isPlaying" class="h-4 w-4" />
              <Play v-else class="h-4 w-4" />
            </button>
          </div>
        </div>

        <!-- ── RIGHT: Product info ── -->
        <div class="flex flex-col gap-5">

          <!-- Brand · line · SKU -->
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-bold text-brand-700">{{ product.brand.name }}</span>
            <span class="text-slate-200">·</span>
            <AppBadge variant="slate">{{ product.productLine.code }} · {{ product.productLine.name }}</AppBadge>
            <span class="text-slate-200">·</span>
            <code class="font-mono text-[11px] font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded">{{ product.sku }}</code>
          </div>

          <!-- Name -->
          <h1 class="text-[1.75rem] font-extrabold text-slate-900 leading-snug flex-1 text-balance tracking-tight">{{ product.name }}</h1>

          <!-- Refrigerant compatibility -->
          <div v-if="product.refrigerants.length" class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-semibold text-slate-500">Compatible con:</span>
            <span
              v-for="r in product.refrigerants"
              :key="r"
              class="font-mono text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded"
            >{{ r }}</span>
          </div>

          <!-- Key specs snapshot -->
          <dl v-if="product.specs.length" class="grid grid-cols-2 gap-x-6 gap-y-2 py-4 border-y border-slate-100">
            <div
              v-for="spec in product.specs.slice(0, 8)"
              :key="spec.key"
              class="flex items-baseline gap-1 min-w-0"
            >
              <dt class="text-xs text-slate-500 shrink-0 truncate" style="max-width: 45%">{{ spec.key }}</dt>
              <span class="text-slate-200 text-xs shrink-0">·</span>
              <dd class="text-xs font-semibold text-slate-900 truncate">
                {{ spec.value }}<span v-if="spec.unit" class="text-slate-400 font-normal"> {{ spec.unit }}</span>
              </dd>
            </div>
          </dl>

          <!-- Price + CTA -->
          <div class="bg-white rounded-2xl p-5 border border-slate-200">
            <!-- WS discounted price -->
            <template v-if="isDiscounted">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-sm text-slate-400 line-through">{{ formatCurrency(basePrice!) }}</span>
                <AppBadge :variant="tierLabel!.startsWith('OEM') ? 'orange' : 'blue'" size="xs">{{ tierLabel }}</AppBadge>
              </div>
              <p class="text-4xl font-extrabold text-slate-900 mb-1">{{ formatCurrency(effectivePrice!) }}</p>
              <div class="flex items-center gap-4 mb-4">
                <p class="text-xs text-slate-400">{{ product.priceCop != null ? 'COP · IVA incluido' : 'USD' }}</p>
                <p v-if="bulkPrice" class="text-xs font-medium text-slate-500">+10 uds: {{ formatCurrency(bulkPrice) }}</p>
              </div>
            </template>
            <!-- Regular price -->
            <template v-else-if="effectivePrice != null">
              <p class="text-4xl font-extrabold text-slate-900 mb-1">{{ formatCurrency(effectivePrice) }}</p>
              <p class="text-xs text-slate-400 mb-4">{{ product.priceCop != null ? 'COP · IVA incluido' : 'USD' }}</p>
            </template>
            <!-- No price set -->
            <template v-else>
              <p class="text-xl font-semibold text-slate-400 mb-4">Consultar precio</p>
            </template>

            <!-- Stock -->
            <div v-if="product.stock > 0" class="flex items-center gap-2 mb-4">
              <div :class="['h-2 w-2 rounded-full flex-shrink-0', product.stock > 5 ? 'bg-emerald-500' : 'bg-amber-500']" />
              <span class="text-sm font-medium" :class="product.stock > 5 ? 'text-emerald-700' : 'text-amber-700'">
                {{ product.stock > 5 ? `${product.stock} unidades en stock` : `Solo ${product.stock} unidades disponibles` }}
              </span>
            </div>

            <!-- Qty + Add to cart -->
            <div class="flex gap-3">
              <div class="flex items-center border border-slate-200 rounded-xl overflow-hidden" role="group" aria-label="Cantidad">
                <button
                  @click="qty > 1 && qty--"
                  aria-label="Reducir cantidad"
                  class="px-3 py-3 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded-l-xl transition-colors text-lg font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                >−</button>
                <span class="px-4 text-base font-semibold min-w-[3rem] text-center border-x border-slate-200">{{ qty }}</span>
                <button
                  @click="(!product.stock || qty < product.stock) && qty++"
                  aria-label="Aumentar cantidad"
                  class="px-3 py-3 text-slate-500 hover:bg-slate-50 active:bg-slate-100 rounded-r-xl transition-colors text-lg font-bold cursor-pointer focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
                >+</button>
              </div>
              <button
                @click="handleAdd"
                :disabled="effectivePrice == null"
                :title="effectivePrice == null ? 'Este producto requiere cotización' : undefined"
                class="flex-1 flex items-center justify-center gap-2 bg-accent-500 hover:bg-accent-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 px-6 rounded-xl transition-colors text-base focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
              >
                <component :is="justAdded ? Check : ShoppingCart" class="h-5 w-5" aria-hidden="true" />
                {{ justAdded ? '¡Agregado al carrito!' : 'Agregar al carrito' }}
              </button>
            </div>
          </div>

          <!-- Description (collapsible) -->
          <div v-if="product.description">
            <p :class="['text-sm text-slate-700 leading-relaxed text-pretty', !showFullDesc && 'line-clamp-3']">
              {{ product.description }}
            </p>
            <button
              v-if="product.description.length > 200"
              @click="showFullDesc = !showFullDesc"
              class="mt-2 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
            >
              {{ showFullDesc ? 'Ver menos' : 'Ver descripción completa ↓' }}
            </button>
          </div>

        </div>
      </div>


    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronRight, ArrowLeft, ShoppingCart, Check, PackageSearch, Pencil, Pause, Play } from '@lucide/vue'
import { useCatalogStore } from '../stores/catalog.store'
import { useCartStore } from '@/modules/cart/stores/cart.store'
import { useAuthStore, formatCurrency } from '@fsparts/core'
import { AppBadge } from '@fsparts/ui'
import { useProductPrice } from '@/modules/catalog/composables/useProductPrice'

const route          = useRoute()
const catalog        = useCatalogStore()
const cart           = useCartStore()
const auth           = useAuthStore()

const product     = computed(() => catalog.getById(route.params.id as string))
const activeImage = ref(0)
const qty         = ref(1)
const justAdded   = ref(false)
const isPlaying   = ref(false)
const showFullDesc = ref(false)

let slideshowTimer: ReturnType<typeof setInterval> | null = null
const SLIDESHOW_INTERVAL = 5000

// First image is the catalog thumbnail — skip it in the detail when there are multiple
const displayImages = computed(() => {
  const imgs = product.value?.images ?? []
  return imgs.length > 1 ? imgs.slice(1) : imgs
})

function startSlideshow() {
  if (slideshowTimer) clearInterval(slideshowTimer)
  slideshowTimer = setInterval(() => {
    const imgs = displayImages.value
    if (imgs.length > 1) activeImage.value = (activeImage.value + 1) % imgs.length
  }, SLIDESHOW_INTERVAL)
  isPlaying.value = true
}

function stopSlideshow() {
  if (slideshowTimer) { clearInterval(slideshowTimer); slideshowTimer = null }
  isPlaying.value = false
}

function toggleSlideshow() {
  isPlaying.value ? stopSlideshow() : startSlideshow()
}

function selectImage(i: number) {
  activeImage.value = i
  if (isPlaying.value) startSlideshow()
}

watch(product, (p) => {
  stopSlideshow()
  activeImage.value = 0
  showFullDesc.value = false
  if (p && displayImages.value.length > 1) startSlideshow()
}, { immediate: true })

onUnmounted(stopSlideshow)

const { effectivePrice, basePrice, isDiscounted, tierLabel, bulkPrice } = useProductPrice(product, qty)

const currentImage = computed(() => {
  const imgs = displayImages.value
  if (activeImage.value < 0 || activeImage.value >= imgs.length) return ''
  return imgs[activeImage.value]
})

function handleAdd() {
  if (!product.value) return
  cart.addToCart(product.value, qty.value)
  justAdded.value = true
  setTimeout(() => (justAdded.value = false), 2000)
}

</script>

<style scoped>
.img-fade-enter-active,
.img-fade-leave-active {
  transition: opacity 0.18s ease-out;
}

.img-fade-enter-from,
.img-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .img-fade-enter-active,
  .img-fade-leave-active {
    transition: none;
  }
}
</style>
