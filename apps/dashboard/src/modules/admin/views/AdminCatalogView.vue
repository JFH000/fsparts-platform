<template>
  <div class="p-8 max-w-4xl">
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Catálogo</h1>
      <p class="text-sm text-slate-500 mt-0.5">Gestiona líneas de producto, marcas y categorías.</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
      <button
        v-for="tab in TABS" :key="tab.id"
        @click="activeTab = tab.id"
        class="px-4 py-2 text-sm font-semibold rounded-lg transition-all"
        :class="activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
      >
        {{ tab.label }}
        <span class="ml-1.5 text-xs font-bold" :class="activeTab === tab.id ? 'text-brand-600' : 'text-slate-400'">
          {{ tab.count() }}
        </span>
      </button>
    </div>

    <!-- ── Líneas de producto ─────────────────────────────────────────────── -->
    <div v-if="activeTab === 'lines'" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 class="text-sm font-bold text-slate-800">Líneas de producto</h2>
        <button v-if="!linesAdding" @click="linesAdding = true" class="add-btn">
          <Plus class="h-3.5 w-3.5" /> Agregar
        </button>
      </div>

      <!-- Add form -->
      <div v-if="linesAdding" class="flex items-center gap-2 px-4 py-3 bg-brand-50 border-b border-brand-100">
        <input v-model="lineForm.code" placeholder="Código (ej. L01)" class="field w-32" maxlength="10" @keyup.enter="saveLine" />
        <input v-model="lineForm.name" placeholder="Nombre de la línea" class="field flex-1" @keyup.enter="saveLine" />
        <button @click="saveLine" :disabled="linesSaving" class="save-btn">
          <Loader2 v-if="linesSaving" class="h-3.5 w-3.5 animate-spin" /><Check v-else class="h-3.5 w-3.5" /> Guardar
        </button>
        <button @click="cancelLines" class="cancel-btn"><X class="h-3.5 w-3.5" /></button>
      </div>

      <p v-if="linesError" class="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{{ linesError }}</p>
      <div v-if="linesLoading" class="py-10 flex justify-center"><Loader2 class="h-5 w-5 animate-spin text-slate-300" /></div>
      <p v-else-if="!lines.length && !linesAdding" class="px-5 py-8 text-sm text-slate-400 text-center">No hay líneas de producto.</p>

      <div v-for="item in lines" :key="item.id" class="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
        <template v-if="linesEditId === item.id">
          <input v-model="linesEditForm.code" class="field w-32" maxlength="10" @keyup.enter="commitLine(item.id)" />
          <input v-model="linesEditForm.name" class="field flex-1" @keyup.enter="commitLine(item.id)" />
          <button @click="commitLine(item.id)" class="save-btn"><Check class="h-3.5 w-3.5" /> Guardar</button>
          <button @click="linesEditId = null" class="cancel-btn"><X class="h-3.5 w-3.5" /></button>
        </template>
        <template v-else>
          <span class="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{{ item.code }}</span>
          <span class="text-sm text-slate-800 flex-1">{{ item.name }}</span>
          <div v-if="linesDelConfirm === item.id" class="flex items-center gap-2">
            <span class="text-xs text-red-500 font-medium">¿Eliminar?</span>
            <button @click="deleteLine(item.id)" class="text-xs font-semibold text-red-600 hover:text-red-700">Sí</button>
            <button @click="linesDelConfirm = null" class="text-xs text-slate-400 hover:text-slate-600">No</button>
          </div>
          <div v-else class="flex gap-1">
            <button @click="startEditLine(item)" class="icon-btn"><Pencil class="h-3.5 w-3.5" /></button>
            <button @click="linesDelConfirm = item.id" class="icon-btn text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 class="h-3.5 w-3.5" /></button>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Marcas ─────────────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'brands'" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 class="text-sm font-bold text-slate-800">Marcas</h2>
        <button v-if="!brandsAdding" @click="brandsAdding = true" class="add-btn">
          <Plus class="h-3.5 w-3.5" /> Agregar
        </button>
      </div>

      <div v-if="brandsAdding" class="flex items-center gap-2 px-4 py-3 bg-brand-50 border-b border-brand-100">
        <input v-model="brandForm.name" placeholder="Nombre de marca" class="field flex-1" @keyup.enter="saveBrand" />
        <input v-model="brandForm.country" placeholder="País (opcional)" class="field w-40" @keyup.enter="saveBrand" />
        <button @click="saveBrand" :disabled="brandsSaving" class="save-btn">
          <Loader2 v-if="brandsSaving" class="h-3.5 w-3.5 animate-spin" /><Check v-else class="h-3.5 w-3.5" /> Guardar
        </button>
        <button @click="cancelBrands" class="cancel-btn"><X class="h-3.5 w-3.5" /></button>
      </div>

      <p v-if="brandsError" class="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{{ brandsError }}</p>
      <div v-if="brandsLoading" class="py-10 flex justify-center"><Loader2 class="h-5 w-5 animate-spin text-slate-300" /></div>
      <p v-else-if="!brands.length && !brandsAdding" class="px-5 py-8 text-sm text-slate-400 text-center">No hay marcas.</p>

      <div v-for="item in brands" :key="item.id" class="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
        <template v-if="brandsEditId === item.id">
          <input v-model="brandsEditForm.name" class="field flex-1" @keyup.enter="commitBrand(item.id)" />
          <input v-model="brandsEditForm.country" placeholder="País" class="field w-40" @keyup.enter="commitBrand(item.id)" />
          <button @click="commitBrand(item.id)" class="save-btn"><Check class="h-3.5 w-3.5" /> Guardar</button>
          <button @click="brandsEditId = null" class="cancel-btn"><X class="h-3.5 w-3.5" /></button>
        </template>
        <template v-else>
          <span class="text-sm text-slate-800 flex-1">{{ item.name }}</span>
          <span v-if="item.country" class="text-xs text-slate-400">{{ item.country }}</span>
          <div v-if="brandsDelConfirm === item.id" class="flex items-center gap-2">
            <span class="text-xs text-red-500 font-medium">¿Eliminar?</span>
            <button @click="deleteBrand(item.id)" class="text-xs font-semibold text-red-600 hover:text-red-700">Sí</button>
            <button @click="brandsDelConfirm = null" class="text-xs text-slate-400 hover:text-slate-600">No</button>
          </div>
          <div v-else class="flex gap-1">
            <button @click="startEditBrand(item)" class="icon-btn"><Pencil class="h-3.5 w-3.5" /></button>
            <button @click="brandsDelConfirm = item.id" class="icon-btn text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 class="h-3.5 w-3.5" /></button>
          </div>
        </template>
      </div>
    </div>

    <!-- ── Categorías ─────────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'categories'" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 class="text-sm font-bold text-slate-800">Categorías</h2>
        <button v-if="!categoriesAdding" @click="categoriesAdding = true" class="add-btn">
          <Plus class="h-3.5 w-3.5" /> Agregar
        </button>
      </div>

      <div v-if="categoriesAdding" class="flex items-center gap-2 px-4 py-3 bg-brand-50 border-b border-brand-100">
        <input v-model="categoryForm.name" placeholder="Nombre de categoría" class="field flex-1" @keyup.enter="saveCategory" />
        <select v-model="categoryForm.product_line_id" class="field w-52">
          <option :value="null">Sin línea</option>
          <option v-for="l in lines" :key="l.id" :value="l.id">{{ l.code }} · {{ l.name }}</option>
        </select>
        <button @click="saveCategory" :disabled="categoriesSaving" class="save-btn">
          <Loader2 v-if="categoriesSaving" class="h-3.5 w-3.5 animate-spin" /><Check v-else class="h-3.5 w-3.5" /> Guardar
        </button>
        <button @click="cancelCategories" class="cancel-btn"><X class="h-3.5 w-3.5" /></button>
      </div>

      <p v-if="categoriesError" class="px-5 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100">{{ categoriesError }}</p>
      <div v-if="categoriesLoading" class="py-10 flex justify-center"><Loader2 class="h-5 w-5 animate-spin text-slate-300" /></div>
      <p v-else-if="!categories.length && !categoriesAdding" class="px-5 py-8 text-sm text-slate-400 text-center">No hay categorías.</p>

      <div v-for="item in categories" :key="item.id" class="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
        <template v-if="categoriesEditId === item.id">
          <input v-model="categoriesEditForm.name" class="field flex-1" @keyup.enter="commitCategory(item.id)" />
          <select v-model="categoriesEditForm.product_line_id" class="field w-52">
            <option :value="null">Sin línea</option>
            <option v-for="l in lines" :key="l.id" :value="l.id">{{ l.code }} · {{ l.name }}</option>
          </select>
          <button @click="commitCategory(item.id)" class="save-btn"><Check class="h-3.5 w-3.5" /> Guardar</button>
          <button @click="categoriesEditId = null" class="cancel-btn"><X class="h-3.5 w-3.5" /></button>
        </template>
        <template v-else>
          <span class="text-sm text-slate-800 flex-1">{{ item.name }}</span>
          <span v-if="item.product_line_id" class="text-xs font-mono text-slate-400">
            {{ lines.find(l => l.id === item.product_line_id)?.code }}
          </span>
          <div v-if="categoriesDelConfirm === item.id" class="flex items-center gap-2">
            <span class="text-xs text-red-500 font-medium">¿Eliminar?</span>
            <button @click="deleteCategory(item.id)" class="text-xs font-semibold text-red-600 hover:text-red-700">Sí</button>
            <button @click="categoriesDelConfirm = null" class="text-xs text-slate-400 hover:text-slate-600">No</button>
          </div>
          <div v-else class="flex gap-1">
            <button @click="startEditCategory(item)" class="icon-btn"><Pencil class="h-3.5 w-3.5" /></button>
            <button @click="categoriesDelConfirm = item.id" class="icon-btn text-slate-400 hover:text-red-500 hover:bg-red-50"><Trash2 class="h-3.5 w-3.5" /></button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from '@lucide/vue'
import {
  listBrands, createBrand, updateBrand, deleteBrand as deleteBrandSvc,
  listCategories, createCategory, updateCategory, deleteCategory as deleteCategorySvc,
  listProductLines, createProductLine, updateProductLine, deleteProductLine as deleteProductLineSvc,
  type Brand, type Category, type ProductLine,
} from '../services/admin.service'

const activeTab = ref<'lines' | 'brands' | 'categories'>('lines')
const TABS = [
  { id: 'lines'      as const, label: 'Líneas de producto', count: () => lines.value.length },
  { id: 'brands'     as const, label: 'Marcas',             count: () => brands.value.length },
  { id: 'categories' as const, label: 'Categorías',         count: () => categories.value.length },
]

const msg = (e: unknown) => e instanceof Error ? e.message : 'Error desconocido'

// ── Líneas ────────────────────────────────────────────────────────────────────
const lines          = ref<ProductLine[]>([])
const linesLoading   = ref(true)
const linesError     = ref('')
const linesAdding    = ref(false)
const linesSaving    = ref(false)
const linesEditId    = ref<number | null>(null)
const linesDelConfirm = ref<number | null>(null)
const lineForm       = reactive({ code: '', name: '' })
const linesEditForm  = reactive({ code: '', name: '' })

async function loadLines() {
  linesLoading.value = true
  try { lines.value = await listProductLines() } catch (e) { linesError.value = msg(e) } finally { linesLoading.value = false }
}
function cancelLines() { linesAdding.value = false; lineForm.code = ''; lineForm.name = '' }
async function saveLine() {
  if (!lineForm.code.trim() || !lineForm.name.trim()) return
  linesSaving.value = true; linesError.value = ''
  try { await createProductLine(lineForm.code.trim(), lineForm.name.trim()); await loadLines(); cancelLines() }
  catch (e) { linesError.value = msg(e) } finally { linesSaving.value = false }
}
function startEditLine(item: ProductLine) { linesEditId.value = item.id; linesEditForm.code = item.code; linesEditForm.name = item.name }
async function commitLine(id: number) {
  linesError.value = ''
  try { await updateProductLine(id, linesEditForm.code.trim(), linesEditForm.name.trim()); await loadLines(); linesEditId.value = null }
  catch (e) { linesError.value = msg(e) }
}
async function deleteLine(id: number) {
  linesError.value = ''
  try { await deleteProductLineSvc(id); lines.value = lines.value.filter(l => l.id !== id); linesDelConfirm.value = null }
  catch (e) { linesError.value = msg(e) }
}

// ── Marcas ────────────────────────────────────────────────────────────────────
const brands          = ref<Brand[]>([])
const brandsLoading   = ref(true)
const brandsError     = ref('')
const brandsAdding    = ref(false)
const brandsSaving    = ref(false)
const brandsEditId    = ref<number | null>(null)
const brandsDelConfirm = ref<number | null>(null)
const brandForm       = reactive({ name: '', country: '' })
const brandsEditForm  = reactive({ name: '', country: '' })

async function loadBrands() {
  brandsLoading.value = true
  try { brands.value = await listBrands() } catch (e) { brandsError.value = msg(e) } finally { brandsLoading.value = false }
}
function cancelBrands() { brandsAdding.value = false; brandForm.name = ''; brandForm.country = '' }
async function saveBrand() {
  if (!brandForm.name.trim()) return
  brandsSaving.value = true; brandsError.value = ''
  try { await createBrand(brandForm.name.trim(), brandForm.country.trim()); await loadBrands(); cancelBrands() }
  catch (e) { brandsError.value = msg(e) } finally { brandsSaving.value = false }
}
function startEditBrand(item: Brand) { brandsEditId.value = item.id; brandsEditForm.name = item.name; brandsEditForm.country = item.country ?? '' }
async function commitBrand(id: number) {
  brandsError.value = ''
  try { await updateBrand(id, brandsEditForm.name.trim(), brandsEditForm.country.trim()); await loadBrands(); brandsEditId.value = null }
  catch (e) { brandsError.value = msg(e) }
}
async function deleteBrand(id: number) {
  brandsError.value = ''
  try { await deleteBrandSvc(id); brands.value = brands.value.filter(b => b.id !== id); brandsDelConfirm.value = null }
  catch (e) { brandsError.value = msg(e) }
}

// ── Categorías ────────────────────────────────────────────────────────────────
const categories          = ref<Category[]>([])
const categoriesLoading   = ref(true)
const categoriesError     = ref('')
const categoriesAdding    = ref(false)
const categoriesSaving    = ref(false)
const categoriesEditId    = ref<number | null>(null)
const categoriesDelConfirm = ref<number | null>(null)
const categoryForm        = reactive({ name: '', product_line_id: null as number | null })
const categoriesEditForm  = reactive({ name: '', product_line_id: null as number | null })

async function loadCategories() {
  categoriesLoading.value = true
  try { categories.value = await listCategories() } catch (e) { categoriesError.value = msg(e) } finally { categoriesLoading.value = false }
}
function cancelCategories() { categoriesAdding.value = false; categoryForm.name = ''; categoryForm.product_line_id = null }
async function saveCategory() {
  if (!categoryForm.name.trim()) return
  categoriesSaving.value = true; categoriesError.value = ''
  try { await createCategory(categoryForm.name.trim(), categoryForm.product_line_id); await loadCategories(); cancelCategories() }
  catch (e) { categoriesError.value = msg(e) } finally { categoriesSaving.value = false }
}
function startEditCategory(item: Category) { categoriesEditId.value = item.id; categoriesEditForm.name = item.name; categoriesEditForm.product_line_id = item.product_line_id }
async function commitCategory(id: number) {
  categoriesError.value = ''
  try { await updateCategory(id, categoriesEditForm.name.trim(), categoriesEditForm.product_line_id); await loadCategories(); categoriesEditId.value = null }
  catch (e) { categoriesError.value = msg(e) }
}
async function deleteCategory(id: number) {
  categoriesError.value = ''
  try { await deleteCategorySvc(id); categories.value = categories.value.filter(c => c.id !== id); categoriesDelConfirm.value = null }
  catch (e) { categoriesError.value = msg(e) }
}

onMounted(() => Promise.all([loadLines(), loadBrands(), loadCategories()]))
</script>

<style scoped>
@reference "../../../style.css";
.field {
  @apply border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder-slate-300
         focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all bg-white;
}
.add-btn {
  @apply flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800
         bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors;
}
.save-btn {
  @apply flex items-center gap-1 text-xs font-semibold text-white bg-brand-700 hover:bg-brand-800
         disabled:opacity-50 px-3 py-2 rounded-lg transition-colors flex-shrink-0;
}
.cancel-btn {
  @apply p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0;
}
.icon-btn {
  @apply p-1.5 rounded-lg text-slate-400 hover:text-brand-700 hover:bg-brand-50 transition-colors;
}
</style>
