import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from './client'
import type { UserProfile } from './types'

export const useAuthStore = defineStore('auth', () => {
  const user    = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const isReady = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin         = computed(() => profile.value?.role === 'admin')
  const role            = computed(() => profile.value?.role ?? null)

  let initPromise: Promise<void> | null = null

  function init(): Promise<void> {
    if (!initPromise) initPromise = _init()
    return initPromise
  }

  async function fetchProfile(userId: string): Promise<void> {
    if (!supabase) return
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      profile.value = data ?? null
    } catch {
      profile.value = null
    }
  }

  async function updateProfile(data: Partial<Omit<UserProfile, 'id' | 'email' | 'role'>>): Promise<void> {
    if (!supabase || !user.value) return
    if (!user.value.email) throw new Error('No hay email asociado a este usuario')
    const { error } = await supabase.from('user_profiles').upsert({
      id:    user.value.id,
      email: user.value.email,
      ...data,
    })
    if (error) throw new Error(error.message)
    await fetchProfile(user.value.id)
  }

  function _init(): Promise<void> {
    if (!supabase) {
      isReady.value = true
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      supabase!.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
        const resolveReady = () => {
          if (!isReady.value) { isReady.value = true; resolve() }
        }
        if (user.value) {
          fetchProfile(user.value.id).finally(resolveReady)
        } else {
          profile.value = null
          resolveReady()
        }
      })
    })
  }

  async function signIn(email: string, password: string) {
    if (!supabase) throw new Error('Supabase no configurado')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signUp(email: string, password: string) {
    if (!supabase) throw new Error('Supabase no configurado')
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    profile.value = null
  }

  return {
    user, profile, role, isReady,
    isAuthenticated, isAdmin,
    init, signIn, signUp, signOut, updateProfile, fetchProfile,
  }
})
