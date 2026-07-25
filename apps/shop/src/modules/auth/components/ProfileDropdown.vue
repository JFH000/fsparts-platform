<template>
  <ProfileDropdown>
    <template #extra-items="{ close }">
      <button
        class="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
        @click="onOrders(close)"
      >
        <Package class="h-3.5 w-3.5 flex-shrink-0" />
        Mis pedidos
      </button>
      <button
        class="flex items-center gap-2.5 w-full text-left px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
        @click="onEditProfile(close)"
      >
        <Pencil class="h-3.5 w-3.5 flex-shrink-0" />
        Editar perfil
      </button>
    </template>
  </ProfileDropdown>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Pencil, Package } from '@lucide/vue'
import { ProfileDropdown, useAuthModal } from '@fsparts/ui'

const { open } = useAuthModal()
const router   = useRouter()

function onEditProfile(closeMenu: () => void) {
  closeMenu()
  open('editProfile')
}

function onOrders(closeMenu: () => void) {
  closeMenu()
  router.push('/orders')
}
</script>
