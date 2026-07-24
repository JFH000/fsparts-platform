<template>
  <div :class="['inline-block animate-spin rounded-full border-2 border-current border-t-transparent', sizes[size]]" role="status">
    <span class="sr-only">Cargando...</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' })
const sizes = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' }
</script>
