<template>
  <AuthModal>
    <template #default="{ mode }">
      <LoginForm      v-if="mode === 'login'" />
      <RegisterForm   v-else-if="mode === 'register'" />
      <OnboardingForm v-else-if="mode === 'onboarding'" />
      <EditProfileForm v-else-if="mode === 'editProfile'" />
    </template>
  </AuthModal>
</template>

<script setup lang="ts">
import { AuthModal } from '@fsparts/ui'
import LoginForm       from './LoginForm.vue'
import RegisterForm    from './RegisterForm.vue'
import OnboardingForm  from './OnboardingForm.vue'
import EditProfileForm from './EditProfileForm.vue'
</script>
