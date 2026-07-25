<template>
  <div class="max-w-4xl mx-auto px-4 py-10">
    <nav class="flex items-center gap-2 text-xs text-slate-400 mb-4">
      <RouterLink to="/" class="hover:text-brand-600">Inicio</RouterLink>
      <ChevronRight class="h-3 w-3" />
      <RouterLink to="/cart" class="hover:text-brand-600">Carrito</RouterLink>
      <ChevronRight class="h-3 w-3" />
      <span class="text-slate-700 font-medium">Checkout</span>
    </nav>

    <div class="flex items-center gap-2 text-xs font-semibold mb-6">
      <span class="text-slate-400">1 Carrito</span>
      <ChevronRight class="h-3 w-3 text-slate-300" />
      <span class="text-brand-700">2 Envío y pago</span>
    </div>

    <h1 class="text-2xl font-bold text-slate-900 mb-8">Finalizar compra</h1>

    <div v-if="!cart.items.length" class="text-center py-20">
      <p class="text-slate-400 mb-4">Tu carrito está vacío.</p>
      <RouterLink to="/catalog" class="text-brand-700 font-semibold hover:text-brand-800">Ver catálogo</RouterLink>
    </div>

    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 class="font-bold text-slate-900 text-lg mb-5">Dirección de envío</h2>

        <div v-if="addresses.length" class="mb-5">
          <label class="field-label" for="saved-address">Dirección guardada</label>
          <select id="saved-address" v-model="selectedAddressId" @change="applySelectedAddress" class="field-input">
            <option value="">+ Nueva dirección</option>
            <option v-for="a in addresses" :key="a.id" :value="a.id">
              {{ a.label || a.full_name }} — {{ a.city }}
            </option>
          </select>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="col-span-2">
            <label class="field-label" for="ship-name">Nombre completo *</label>
            <input id="ship-name" v-model="form.name" type="text" class="field-input" placeholder="Nombre y apellido" />
          </div>
          <div>
            <label class="field-label" for="ship-phone">Teléfono *</label>
            <input id="ship-phone" v-model="form.phone" type="tel" class="field-input" placeholder="+57 300 000 0000" />
          </div>
          <div>
            <label class="field-label" for="ship-city">Ciudad *</label>
            <input id="ship-city" v-model="form.city" type="text" class="field-input" placeholder="Bogotá" />
          </div>
          <div class="col-span-2">
            <label class="field-label" for="ship-address">Dirección *</label>
            <input id="ship-address" v-model="form.address" type="text" class="field-input" placeholder="Calle 00 # 00-00" />
          </div>

          <div class="col-span-2 border-t border-slate-100 pt-4 mt-1">
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Datos de facturación (opcional)</p>
          </div>
          <div>
            <label class="field-label" for="ship-company">Empresa</label>
            <input id="ship-company" v-model="form.company" type="text" class="field-input" placeholder="Nombre de empresa" />
          </div>
          <div>
            <label class="field-label" for="ship-taxid">NIT / Cédula</label>
            <input id="ship-taxid" v-model="form.taxId" type="text" class="field-input" placeholder="900.123.456-7" />
          </div>

          <div class="col-span-2">
            <label class="field-label" for="ship-notes">Notas (opcional)</label>
            <textarea id="ship-notes" v-model="form.notes" rows="2" class="field-input resize-none" placeholder="Referencias adicionales…" />
          </div>
        </div>

        <label class="flex items-center gap-2 mt-4 text-sm text-slate-600 cursor-pointer">
          <input v-model="saveAddress" type="checkbox" class="rounded border-slate-300 text-brand-700 focus:ring-brand-500" />
          Guardar esta dirección para futuros pedidos
        </label>

        <div v-if="formError" class="mt-4 px-4 py-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium">
          {{ formError }}
        </div>
      </div>

      <div class="lg:col-span-1">
        <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 sticky top-32">
          <div class="flex items-center justify-between mb-5">
            <h2 class="font-bold text-slate-900 text-lg">Resumen del pedido</h2>
            <RouterLink to="/cart" class="text-xs font-semibold text-brand-700 hover:text-brand-800">Editar</RouterLink>
          </div>
          <div class="space-y-3 mb-5 pb-5 border-b border-slate-100">
            <div v-for="item in cart.items" :key="item.product.id" class="flex justify-between text-sm text-slate-600">
              <span class="truncate max-w-[160px]">{{ item.product.name }} <span class="text-slate-400">×{{ item.quantity }}</span></span>
              <span class="font-medium flex-shrink-0">{{ formatCurrency(cart.lineUnitPrice(item) * item.quantity) }}</span>
            </div>
          </div>
          <div class="flex justify-between items-center font-extrabold text-slate-900 text-xl pt-1">
            <span>Total</span>
            <span>{{ formatCurrency(cart.subtotal) }}</span>
          </div>
          <p class="text-xs text-slate-400 text-right mb-6">COP · IVA incluido</p>

          <div v-if="dropped.length" class="mb-4 px-4 py-3 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-sm">
            <p class="font-semibold mb-1">Algunos productos ya no están disponibles:</p>
            <ul class="list-disc list-inside space-y-0.5">
              <li v-for="d in dropped" :key="d">{{ d }}</li>
            </ul>
          </div>

          <AppButton
            variant="accent"
            size="lg"
            full
            :loading="paying"
            @click="onPayClick"
          >
            {{ dropped.length ? 'Continuar de todas formas →' : 'Pagar con Stripe →' }}
          </AppButton>

          <p class="text-xs text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
            <Lock class="h-3 w-3" aria-hidden="true" />
            Pago seguro procesado por Stripe
          </p>
          <p class="text-xs text-slate-400 text-center mt-1">Envío por cotizar, te contactaremos.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { ChevronRight, Lock } from '@lucide/vue'
import { AppButton } from '@fsparts/ui'
import { useCartStore } from '../stores/cart.store'
import { useAuthStore } from '@fsparts/core'
import { formatCurrency } from '@fsparts/core'
import { createCheckoutSession } from '../services/checkout.service'
import { listAddresses, createAddress } from '../services/addresses.service'
import { useToast } from '@fsparts/ui'
import type { ShippingAddress } from '@fsparts/core'

const cart = useCartStore()
const auth = useAuthStore()
const toast = useToast()

const form = reactive({ name: '', phone: '', company: '', taxId: '', address: '', city: '', notes: '' })
const paying    = ref(false)
const formError = ref('')
const dropped     = ref<string[]>([])
const pendingUrl   = ref<string | null>(null)
const addresses    = ref<ShippingAddress[]>([])
const selectedAddressId = ref('')
const saveAddress  = ref(false)

onMounted(async () => {
  if (auth.profile) {
    form.name    = auth.profile.full_name ?? ''
    form.phone   = auth.profile.phone ?? ''
    form.company = auth.profile.company ?? ''
  }
  try {
    addresses.value  = await listAddresses()
    saveAddress.value = addresses.value.length === 0
  } catch {
    // Address book is a convenience, not a blocker — checkout works without it.
  }
})

function applySelectedAddress() {
  const a = addresses.value.find(x => x.id === selectedAddressId.value)
  if (!a) return
  form.name    = a.full_name
  form.phone   = a.phone
  form.company = a.company ?? ''
  form.taxId   = a.tax_id ?? ''
  form.address = a.address
  form.city    = a.city
  form.notes   = a.notes ?? ''
}

async function persistAddressIfRequested() {
  if (!saveAddress.value || !auth.user) return
  try {
    await createAddress(auth.user.id, {
      label: null,
      full_name: form.name, phone: form.phone,
      company: form.company || null, tax_id: form.taxId || null,
      address: form.address, city: form.city, notes: form.notes || null,
      is_default: addresses.value.length === 0,
    })
  } catch {
    toast.add({ message: 'No se pudo guardar la dirección, pero tu pedido continúa.' })
  }
}

function onPayClick() {
  if (pendingUrl.value) {
    paying.value = true
    window.location.href = pendingUrl.value
    return
  }
  handlePay()
}

async function handlePay() {
  formError.value = ''
  dropped.value = []
  if (!form.name.trim() || !form.phone.trim() || !form.address.trim() || !form.city.trim()) {
    formError.value = 'Completa todos los campos obligatorios de envío.'
    return
  }
  paying.value = true
  try {
    await persistAddressIfRequested()
    const { url, dropped: droppedItems } = await createCheckoutSession(cart.items, {
      name: form.name, phone: form.phone,
      company: form.company || undefined, taxId: form.taxId || undefined,
      address: form.address, city: form.city, notes: form.notes || undefined,
    })
    if (droppedItems.length > 0) {
      dropped.value    = droppedItems
      pendingUrl.value = url
      paying.value     = false
      return
    }
    window.location.href = url
  } catch (e: unknown) {
    formError.value = e instanceof Error ? e.message : 'Error al iniciar el pago'
    paying.value = false
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
</style>
