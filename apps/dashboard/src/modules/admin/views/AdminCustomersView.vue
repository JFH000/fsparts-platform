<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900">Clientes</h1>
      <p class="text-sm text-slate-500 mt-0.5">{{ customers.length }} usuarios registrados</p>
    </div>

    <!-- Search + role filter bar -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-64">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
        <input
          v-model="searchQuery"
          placeholder="Buscar por nombre, email o empresa..."
          class="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
        />
      </div>
      <div class="flex flex-wrap gap-1.5" role="list" aria-label="Filtrar por rol">
        <button
          v-for="f in roleFilters"
          :key="f.value"
          @click="activeRole = f.value"
          :aria-pressed="activeRole === f.value"
          :class="[
            'text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors',
            activeRole === f.value
              ? 'bg-brand-700 border-brand-700 text-white'
              : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700',
          ]"
        >
          {{ f.label }}
          <span class="ml-1 font-normal opacity-60">{{ f.count }}</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <AppSpinner size="lg" class="text-brand-600" />
    </div>

    <!-- Error -->
    <div v-else-if="loadError" class="text-center py-16">
      <p class="text-sm text-red-500 mb-3">{{ loadError }}</p>
      <button @click="loadCustomers" class="text-xs text-brand-600 underline hover:text-brand-700">Reintentar</button>
    </div>

    <!-- Table -->
    <div v-else class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-100 bg-slate-50">
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Cliente</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Empresa</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 hidden md:table-cell">Teléfono</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400">Rol</th>
            <th class="text-left px-5 py-3 text-xs font-semibold text-slate-400 hidden lg:table-cell">Miembro desde</th>
            <th class="px-5 py-3" />
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr
            v-for="c in filtered"
            :key="c.id"
            @click="openPanel(c)"
            class="hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <td class="px-5 py-3.5">
              <div class="flex items-center gap-3">
                <div :class="['w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 select-none', avatarClass(c)]">
                  {{ initials(c.full_name ?? c.email) }}
                </div>
                <div class="min-w-0">
                  <p class="font-semibold text-slate-900 truncate">{{ c.full_name ?? '—' }}</p>
                  <p class="text-xs text-slate-400 truncate">{{ c.email }}</p>
                </div>
              </div>
            </td>
            <td class="px-5 py-3.5 text-slate-600 text-sm">{{ c.company ?? '—' }}</td>
            <td class="px-5 py-3.5 text-slate-600 text-sm hidden md:table-cell">{{ c.phone ?? '—' }}</td>
            <td class="px-5 py-3.5">
              <span :class="['inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full', roleBadgeClass(c.role)]">
                {{ roleLabel(c.role) }}
              </span>
            </td>
            <td class="px-5 py-3.5 text-slate-400 text-xs hidden lg:table-cell">{{ formatDate(c.created_at) }}</td>
            <td class="px-5 py-3.5">
              <ChevronRight class="h-4 w-4 text-slate-300" aria-hidden="true" />
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="!filtered.length && !loading" class="py-16 text-center text-slate-400 text-sm">
        No se encontraron clientes
      </div>
    </div>

    <!-- Slide-over detail panel -->
    <Teleport to="body">
      <Transition name="fade">
        <div v-if="selected" class="fixed inset-0 bg-black/30 z-50" @click="closePanel" aria-hidden="true" />
      </Transition>
      <Transition name="slide-right">
        <div
          v-if="selected"
          role="dialog"
          aria-modal="true"
          aria-labelledby="panel-customer-name"
          class="fixed top-0 right-0 h-full w-96 bg-white z-50 shadow-2xl flex flex-col"
        >
          <!-- Panel header -->
          <div class="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              <div :class="['w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none', avatarClass(selected)]">
                {{ initials(selected.full_name ?? selected.email) }}
              </div>
              <div class="min-w-0">
                <p id="panel-customer-name" class="font-bold text-slate-900 truncate">{{ selected.full_name ?? '—' }}</p>
                <p class="text-xs text-slate-400 truncate">{{ selected.email }}</p>
              </div>
            </div>
            <button
              @click="closePanel"
              aria-label="Cerrar panel"
              class="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors flex-shrink-0 focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X class="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <!-- Panel body -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5">
            <!-- Info grid -->
            <dl class="space-y-3">
              <div class="flex justify-between text-sm gap-4">
                <dt class="text-slate-500 flex-shrink-0">Empresa</dt>
                <dd class="font-medium text-slate-900 text-right">{{ selected.company ?? '—' }}</dd>
              </div>
              <div class="flex justify-between text-sm gap-4">
                <dt class="text-slate-500 flex-shrink-0">Teléfono</dt>
                <dd class="font-medium text-slate-900 text-right">{{ selected.phone ?? '—' }}</dd>
              </div>
              <div class="flex justify-between text-sm gap-4">
                <dt class="text-slate-500 flex-shrink-0">Miembro desde</dt>
                <dd class="font-medium text-slate-900 text-right">{{ formatDate(selected.created_at) }}</dd>
              </div>
            </dl>

            <div class="border-t border-slate-100 pt-5 space-y-4">
              <!-- Role selector -->
              <div>
                <label for="panel-role" class="block text-xs font-semibold text-slate-500 mb-1.5">Rol</label>
                <select
                  id="panel-role"
                  v-model="panelRole"
                  :disabled="selected.role === 'admin'"
                  class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                >
                  <option value="customer">customer — Precio estándar</option>
                  <option value="customer_ws1">customer_ws1 — Mayorista</option>
                  <option value="customer_ws3">customer_ws3 — OEM</option>
                  <option value="admin" disabled>admin (no cambiar)</option>
                </select>
                <p v-if="selected.role === 'admin'" class="text-xs text-slate-400 mt-1">
                  El rol de administrador no puede modificarse desde aquí.
                </p>
              </div>

              <!-- Notes -->
              <div>
                <label for="panel-notes" class="block text-xs font-semibold text-slate-500 mb-1.5">Notas internas</label>
                <textarea
                  id="panel-notes"
                  v-model="panelNotes"
                  rows="4"
                  placeholder="Notas visibles solo para el equipo interno..."
                  class="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          <!-- Panel footer -->
          <div class="p-6 border-t border-slate-100 flex-shrink-0">
            <p v-if="saveError" class="text-xs text-red-500 mb-3">{{ saveError }}</p>
            <button
              @click="saveChanges"
              :disabled="saving || selected.role === 'admin'"
              class="w-full bg-brand-700 text-white font-semibold py-2.5 rounded-xl hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            >
              {{ saving ? 'Guardando...' : 'Guardar cambios' }}
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Search, ChevronRight, X } from '@lucide/vue'
import { AppSpinner } from '@fsparts/ui'
import {
  listCustomers,
  updateCustomerRole,
  updateCustomerNotes,
  type CustomerRow,
} from '../services/customers.service'
import type { UserRole } from '@fsparts/core'

// ── State ──────────────────────────────────────────────────────────────────────

const customers   = ref<CustomerRow[]>([])
const loading     = ref(true)
const loadError   = ref<string | null>(null)
const searchQuery = ref('')
const activeRole  = ref<UserRole | 'all'>('all')

const selected   = ref<CustomerRow | null>(null)
const panelRole  = ref<UserRole>('customer')
const panelNotes = ref('')
const saving     = ref(false)
const saveError  = ref<string | null>(null)

// ── Derived ────────────────────────────────────────────────────────────────────

const roleFilters = computed(() => {
  const count = (r: string) => customers.value.filter(c => c.role === r).length
  return [
    { value: 'all'          as const, label: 'Todos',    count: customers.value.length },
    { value: 'customer'     as const, label: 'customer', count: count('customer') },
    { value: 'customer_ws1' as const, label: 'WS1',      count: count('customer_ws1') },
    { value: 'customer_ws3' as const, label: 'OEM',      count: count('customer_ws3') },
    { value: 'admin'        as const, label: 'Admin',    count: count('admin') },
  ]
})

const filtered = computed(() => {
  let list = customers.value
  if (activeRole.value !== 'all') {
    list = list.filter(c => c.role === activeRole.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(c =>
      (c.full_name ?? '').toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.company ?? '').toLowerCase().includes(q)
    )
  }
  return list
})

// ── Actions ────────────────────────────────────────────────────────────────────

async function loadCustomers() {
  loading.value   = true
  loadError.value = null
  try {
    customers.value = await listCustomers()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function openPanel(c: CustomerRow) {
  selected.value   = c
  panelRole.value  = c.role
  panelNotes.value = c.notes ?? ''
  saveError.value  = null
}

function closePanel() {
  selected.value = null
}

async function saveChanges() {
  if (!selected.value || selected.value.role === 'admin') return
  saving.value    = true
  saveError.value = null
  try {
    await updateCustomerRole(selected.value.id, panelRole.value)
    await updateCustomerNotes(selected.value.id, panelNotes.value)
    const idx = customers.value.findIndex(c => c.id === selected.value!.id)
    if (idx !== -1) {
      customers.value[idx] = {
        ...customers.value[idx],
        role:  panelRole.value,
        notes: panelNotes.value,
      }
    }
    closePanel()
  } catch (e) {
    saveError.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return name.split(/\s+/).map(p => p[0] ?? '').join('').toUpperCase().slice(0, 2) || '?'
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-teal-100 text-teal-700',
]

function avatarClass(c: CustomerRow): string {
  const code = (c.full_name ?? c.email).charCodeAt(0)
  return AVATAR_COLORS[code % AVATAR_COLORS.length]
}

function roleBadgeClass(role: UserRole): string {
  if (role === 'customer_ws1') return 'bg-brand-50 text-brand-700'
  if (role === 'customer_ws3') return 'bg-orange-50 text-orange-600'
  if (role === 'admin')        return 'bg-red-50 text-red-600'
  return 'bg-slate-100 text-slate-600'
}

function roleLabel(role: UserRole): string {
  if (role === 'customer_ws1') return 'WS1 · Mayorista'
  if (role === 'customer_ws3') return 'OEM'
  if (role === 'admin')        return 'Admin'
  return 'Customer'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closePanel()
}

onMounted(() => {
  loadCustomers()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>
