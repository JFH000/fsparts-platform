<template>
  <div ref="formTop" class="max-w-4xl mx-auto px-8 py-8">
    <!-- Header -->
    <div class="flex items-start justify-between mb-8">
      <div>
        <div class="flex items-center gap-2 text-xs text-slate-400 mb-2">
          <RouterLink to="/products" class="hover:text-slate-600 transition-colors">Productos</RouterLink>
          <ChevronRight class="h-3 w-3" />
          <span class="text-slate-600">{{ isEditMode ? 'Editar' : 'Nuevo' }}</span>
        </div>
        <h1 class="text-2xl font-bold text-slate-900">
          {{ isEditMode ? form.name || 'Editar producto' : 'Nuevo producto' }}
        </h1>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <RouterLink
          to="/products"
          class="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl transition-all"
        >
          Cancelar
        </RouterLink>
        <button
          @click="handleSave"
          :disabled="isSaving"
          class="flex items-center gap-2 px-5 py-2.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
        >
          <Loader2 v-if="isSaving" class="h-4 w-4 animate-spin" />
          <Save v-else class="h-4 w-4" />
          Guardar
        </button>
      </div>
    </div>

    <!-- Page error -->
    <div v-if="pageError" class="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
      {{ pageError }}
    </div>

    <!-- Loading (edit) -->
    <div v-if="isLoadingProduct" class="flex items-center justify-center py-24">
      <Loader2 class="h-8 w-8 text-brand-600 animate-spin" />
    </div>

    <div v-else class="space-y-5">

      <!-- ── Información básica ───────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">Información básica</h2>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="field-label">Nombre *</label>
            <input v-model="form.name" @input="onNameInput" type="text" class="field-input" placeholder="Nombre del producto" />
          </div>
          <div>
            <label class="field-label">SKU *</label>
            <input v-model="form.sku" type="text" class="field-input font-mono" placeholder="DAN-068Z3073" />
          </div>
          <div class="col-span-2">
            <label class="field-label">
              Slug (URL)
              <span class="text-slate-400 font-normal normal-case tracking-normal"> — se genera del nombre</span>
            </label>
            <input
              v-model="form.slug"
              @input="slugTouched = true"
              type="text"
              class="field-input font-mono text-sm"
              placeholder="nombre-del-producto"
            />
          </div>
          <div class="col-span-2">
            <label class="field-label">Descripción</label>
            <textarea v-model="form.description" rows="4" class="field-input resize-none" placeholder="Descripción detallada del producto…" />
          </div>
        </div>
      </div>

      <!-- ── Clasificación ───────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">Clasificación</h2>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="field-label">Línea de producto</label>
            <select v-model="form.product_line_id" @change="form.category_id = null" class="field-input">
              <option :value="null">Seleccionar…</option>
              <option v-for="l in productLines" :key="l.id" :value="l.id">
                {{ l.code }} · {{ l.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="field-label">Marca</label>
            <select v-model="form.brand_id" class="field-input">
              <option :value="null">Seleccionar…</option>
              <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div>
            <label class="field-label">Categoría</label>
            <select v-model="form.category_id" class="field-input">
              <option :value="null">Seleccionar…</option>
              <option v-for="c in filteredCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- ── Precios y stock ─────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Precios y stock</h2>
          <button
            type="button"
            @click="autoPrice"
            :disabled="!form.price_cop"
            class="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Zap class="h-4 w-4" />
            Auto precio
          </button>
        </div>
        <div class="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label class="field-label">Precio USD</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
              <input v-model="form.price_usd" type="number" min="0" step="0.01" class="field-input has-prefix" placeholder="—" />
            </div>
          </div>
          <div>
            <label class="field-label">Precio COP</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
              <input v-model="form.price_cop" type="number" min="0" step="0.01" class="field-input has-prefix" placeholder="—" />
            </div>
          </div>
          <div>
            <label class="field-label">Stock</label>
            <input
              v-model="form.stock"
              type="number"
              min="0"
              step="1"
              class="field-input"
              placeholder="0"
            />
          </div>
        </div>
        <div class="grid grid-cols-4 gap-4">
          <div v-for="tier in (['ws1','ws2','ws3','ws4'] as const)" :key="tier">
            <label class="field-label">{{ tier.toUpperCase() }}</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">$</span>
              <input v-model="form[`price_${tier}`]" type="number" min="0" step="0.01" class="field-input has-prefix" placeholder="—" />
            </div>
          </div>
        </div>

        <div class="flex items-center gap-6 mt-5 pt-5 border-t border-slate-100">
          <label class="flex items-center gap-2.5 cursor-pointer group">
            <div
              class="w-9 h-5 rounded-full transition-colors relative flex-shrink-0"
              :class="form.is_featured ? 'bg-brand-600' : 'bg-slate-200'"
              @click="form.is_featured = !form.is_featured"
            >
              <div
                class="absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform"
                :class="form.is_featured ? 'translate-x-4' : 'translate-x-0.5'"
              />
            </div>
            <span class="text-sm font-medium text-slate-700">Destacado</span>
          </label>
          <label class="flex items-center gap-2.5 cursor-pointer group">
            <div
              class="w-9 h-5 rounded-full transition-colors relative flex-shrink-0"
              :class="form.is_new ? 'bg-emerald-500' : 'bg-slate-200'"
              @click="form.is_new = !form.is_new"
            >
              <div
                class="absolute top-0.5 h-4 w-4 bg-white rounded-full shadow transition-transform"
                :class="form.is_new ? 'translate-x-4' : 'translate-x-0.5'"
              />
            </div>
            <span class="text-sm font-medium text-slate-700">Nuevo</span>
          </label>
        </div>
      </div>

      <!-- ── Imágenes ────────────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">Imágenes</h2>

        <!-- Drop / upload zone -->
        <div
          class="relative border-2 border-dashed rounded-xl p-6 text-center transition-colors mb-4"
          :class="isDragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300'"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop.prevent="onDrop"
        >
          <input ref="fileInput" type="file" accept="image/*" multiple class="sr-only" @change="onFileChange" />
          <ImagePlus class="h-8 w-8 mx-auto mb-2" :class="isDragging ? 'text-brand-500' : 'text-slate-300'" />
          <p class="text-sm text-slate-500 mb-2">Arrastra imágenes aquí o</p>
          <button
            type="button"
            :disabled="isUploading"
            @click="fileInput?.click()"
            class="px-4 py-1.5 bg-brand-700 hover:bg-brand-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {{ isUploading ? 'Subiendo…' : 'Seleccionar archivos' }}
          </button>
          <p class="text-xs text-slate-400 mt-2">JPEG, PNG o WebP · se convierten a WebP automáticamente</p>
          <div v-if="isUploading" class="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
            <Loader2 class="h-6 w-6 text-brand-600 animate-spin" />
          </div>
        </div>

        <!-- URL manual -->
        <div class="flex gap-2 mb-4">
          <input
            v-model="imageInput"
            type="url"
            class="field-input flex-1"
            placeholder="O pega una URL directa…"
            @keydown.enter.prevent="addImage"
          />
          <button
            type="button"
            @click="addImage"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl transition-colors flex-shrink-0"
          >
            Agregar URL
          </button>
        </div>

        <!-- Upload error -->
        <p v-if="uploadError" class="text-xs text-red-500 mb-3">{{ uploadError }}</p>

        <!-- Image list -->
        <div v-if="form.images.length" class="space-y-2">
          <div
            v-for="(img, i) in form.images"
            :key="i"
            class="flex items-center gap-3 bg-slate-50 rounded-xl p-2.5"
          >
            <img
              :src="img"
              alt=""
              class="h-10 w-10 object-contain rounded-lg bg-white border border-slate-100 flex-shrink-0 p-0.5"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <span class="text-xs text-slate-500 truncate flex-1 font-mono">{{ img }}</span>
            <button type="button" @click="form.images.splice(i, 1)" class="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-slate-400">Sin imágenes. Sube archivos o agrega una URL.</p>
      </div>

      <!-- ── Refrigerantes ───────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-5">Refrigerantes compatibles</h2>
        <div class="flex flex-wrap gap-2">
          <label
            v-for="r in REFRIGERANTS"
            :key="r"
            class="flex items-center gap-2 cursor-pointer px-3.5 py-1.5 rounded-full border text-sm font-medium transition-all select-none"
            :class="form.refrigerants.includes(r)
              ? 'bg-brand-700 border-brand-700 text-white shadow-sm'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-700'"
          >
            <input type="checkbox" :value="r" v-model="form.refrigerants" class="sr-only" />
            {{ r }}
          </label>
        </div>
      </div>

      <!-- ── Especificaciones ────────────────────────────────── -->
      <div class="bg-white rounded-2xl border border-slate-200 p-6">
        <div class="flex items-center justify-between mb-5">
          <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider">Especificaciones técnicas</h2>
          <button
            type="button"
            @click="addSpec"
            class="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 transition-colors"
          >
            <Plus class="h-4 w-4" />
            Agregar fila
          </button>
        </div>

        <div v-if="form.specs.length" class="space-y-2">
          <div class="grid gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1 mb-1" style="grid-template-columns: 1fr 1fr 100px 130px 28px">
            <span>Propiedad</span>
            <span>Valor</span>
            <span>Unidad</span>
            <span>Grupo</span>
            <span />
          </div>
          <div
            v-for="(spec, i) in form.specs"
            :key="i"
            class="grid gap-2 items-center"
            style="grid-template-columns: 1fr 1fr 100px 130px 28px"
          >
            <input v-model="spec.key"   type="text" class="field-input text-sm" placeholder="Capacidad" />
            <input v-model="spec.value" type="text" class="field-input text-sm" placeholder="5–12" />
            <input v-model="spec.unit"  type="text" class="field-input text-sm" placeholder="TR" />
            <input v-model="spec.group" type="text" class="field-input text-sm" placeholder="Rendimiento" />
            <button type="button" @click="form.specs.splice(i, 1)" class="flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors">
              <X class="h-4 w-4" />
            </button>
          </div>
        </div>
        <p v-else class="text-sm text-slate-400">Sin especificaciones. Agrega filas con el botón de arriba.</p>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Loader2, Save, Plus, X, ImagePlus, Zap } from '@lucide/vue'
import { supabase, fetchProductLines, fetchBrands, fetchCategories, type ProductLine, type Brand, type Category } from '@fsparts/core'
import {
  getAdminProduct,
  createProduct,
  updateProduct,
  type ProductPayload,
} from '../services/admin.service'
import { useToast } from '@fsparts/ui'

const { add: addToast } = useToast()

const route  = useRoute()
const router = useRouter()

const productLines = ref<ProductLine[]>([])
const brands        = ref<Brand[]>([])
const categories     = ref<Category[]>([])

const REFRIGERANTS = ['R-22', 'R-134a', 'R-404A', 'R-407C', 'R-410A', 'R-448A', 'R-449A', 'R-507']

const isEditMode       = computed(() => !!route.params.id)
const isLoadingProduct = ref(false)
const isSaving         = ref(false)
const pageError        = ref('')
const slugTouched      = ref(false)
const imageInput       = ref('')
const formTop          = ref<HTMLElement | null>(null)
const fileInput        = ref<HTMLInputElement | null>(null)
const isUploading      = ref(false)
const isDragging       = ref(false)
const uploadError      = ref('')

function showError(msg: string) {
  pageError.value = msg
  nextTick(() => formTop.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
}

type SpecRow = { key: string; value: string; unit: string; group: string }
interface FormState {
  sku: string; name: string; slug: string; description: string
  brand_id: number | null; category_id: number | null; product_line_id: number | null
  price_usd: number | ''; price_cop: number | ''
  price_ws1: number | ''; price_ws2: number | ''; price_ws3: number | ''; price_ws4: number | ''
  stock: number | ''
  is_featured: boolean; is_new: boolean
  images: string[]
  specs: SpecRow[]
  refrigerants: string[]
}

const form = reactive<FormState>({
  sku: '', name: '', slug: '', description: '',
  brand_id: null, category_id: null, product_line_id: null,
  price_usd: '', price_cop: '',
  price_ws1: '', price_ws2: '', price_ws3: '', price_ws4: '',
  stock: '',
  is_featured: false, is_new: false,
  images: [], specs: [], refrigerants: [],
})

onMounted(async () => {
  const [lineList, brandList, categoryList] = await Promise.all([fetchProductLines(), fetchBrands(), fetchCategories()])
  productLines.value = lineList
  brands.value        = brandList
  categories.value    = categoryList
})

const filteredCategories = computed(() => {
  if (!form.product_line_id) return categories.value
  return categories.value.filter((c) => c.productLineId === form.product_line_id)
})

function slugify(s: string) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function onNameInput() {
  if (!slugTouched.value) form.slug = slugify(form.name)
}

watch(() => form.name, () => { if (!slugTouched.value) form.slug = slugify(form.name) })

function addImage() {
  const url = imageInput.value.trim()
  if (url && !form.images.includes(url)) form.images.push(url)
  imageInput.value = ''
}

function toWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = img.naturalWidth
      canvas.height = img.naturalHeight
      canvas.getContext('2d')!.drawImage(img, 0, 0)
      canvas.toBlob(
        blob => { URL.revokeObjectURL(url); blob ? resolve(blob) : reject(new Error('Conversión fallida')) },
        'image/webp', 0.85,
      )
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')) }
    img.src = url
  })
}

async function uploadFiles(files: File[]) {
  if (!supabase || !files.length) return
  uploadError.value = ''
  isUploading.value = true
  try {
    for (const file of files) {
      const blob = await toWebP(file)
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
      const { error } = await supabase.storage.from('product-images').upload(path, blob, { contentType: 'image/webp' })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('product-images').getPublicUrl(path)
      if (data.publicUrl && !form.images.includes(data.publicUrl)) form.images.push(data.publicUrl)
    }
  } catch (e: unknown) {
    uploadError.value = e instanceof Error ? e.message : 'Error al subir imagen'
  } finally {
    isUploading.value = false
    isDragging.value  = false
  }
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files?.length) uploadFiles(Array.from(files))
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'))
  if (files.length) uploadFiles(files)
}

function addSpec() {
  form.specs.push({ key: '', value: '', unit: '', group: '' })
}

function autoPrice() {
  const cop = Number(form.price_cop)
  if (!cop) return
  form.price_ws1 = Math.round(cop * 0.90)
  form.price_ws2 = Math.round(cop * 0.80)
  form.price_ws3 = Math.round(cop * 0.78)
  form.price_ws4 = Math.round(cop * 0.75)
}

onMounted(async () => {
  if (!isEditMode.value) return
  isLoadingProduct.value = true
  try {
    const p = await getAdminProduct(route.params.id as string)
    form.sku             = p.sku
    form.name            = p.name
    form.slug            = p.slug
    form.description     = p.description
    form.brand_id        = p.brand_id
    form.category_id     = p.category_id
    form.product_line_id = p.product_line_id
    form.price_usd       = p.price_usd  ?? ''
    form.price_cop       = p.price_cop  ?? ''
    form.price_ws1       = p.price_ws1  ?? ''
    form.price_ws2       = p.price_ws2  ?? ''
    form.price_ws3       = p.price_ws3  ?? ''
    form.price_ws4       = p.price_ws4  ?? ''
    form.stock           = p.stock
    form.is_featured     = p.is_featured
    form.is_new          = p.is_new
    form.images          = [...p.images]
    form.refrigerants    = [...p.refrigerants]
    form.specs           = p.specs.map(s => ({
      key: s.key || s.label || '', value: s.value, unit: s.unit ?? '', group: s.group ?? '',
    }))
    slugTouched.value = true
  } catch (e: unknown) {
    showError(e instanceof Error ? e.message : 'Error cargando producto')
  } finally {
    isLoadingProduct.value = false
  }
})

async function handleSave() {
  pageError.value = ''
  if (!form.name || !form.sku) {
    showError('Nombre y SKU son obligatorios.')
    return
  }
  isSaving.value = true
  const toNum = (v: number | '') => v !== '' ? Number(v) : null
  try {
    const payload: ProductPayload = {
      sku:             form.sku,
      name:            form.name,
      slug:            form.slug || slugify(form.name),
      description:     form.description,
      brand_id:        form.brand_id,
      category_id:     form.category_id,
      product_line_id: form.product_line_id,
      price_usd:       toNum(form.price_usd),
      price_cop:       toNum(form.price_cop),
      price_ws1:       toNum(form.price_ws1),
      price_ws2:       toNum(form.price_ws2),
      price_ws3:       toNum(form.price_ws3),
      price_ws4:       toNum(form.price_ws4),
      stock:           Number(form.stock) || 0,
      is_featured:     form.is_featured,
      is_new:          form.is_new,
      images:          form.images,
      specs:           form.specs.filter(s => s.key).map(s => ({
        key: s.key, value: s.value,
        ...(s.unit  ? { unit: s.unit }   : {}),
        ...(s.group ? { group: s.group } : {}),
      })),
      refrigerants:    form.refrigerants,
    }

    if (isEditMode.value) {
      await updateProduct(route.params.id as string, payload)
      addToast({ message: 'Producto guardado' })
    } else {
      await createProduct(payload)
    }
    router.push('/products')
  } catch (e: unknown) {
    showError(e instanceof Error ? e.message : 'Error al guardar')
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
@reference "../../../style.css";

.field-label {
  @apply block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5;
}
.field-input {
  @apply w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-300
         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all;
}
.field-input.has-prefix {
  padding-left: 1.75rem;
}
</style>
