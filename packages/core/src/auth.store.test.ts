import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth.store'

describe('useAuthStore.isAdmin', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('is false when there is no profile', () => {
    const auth = useAuthStore()
    expect(auth.isAdmin).toBe(false)
  })

  it('is false for a non-admin role', () => {
    const auth = useAuthStore()
    auth.profile = { id: 'u1', full_name: null, email: 'a@test.co', phone: null, role: 'customer', company: null, notes: null }
    expect(auth.isAdmin).toBe(false)
  })

  it('is true when role is admin', () => {
    const auth = useAuthStore()
    auth.profile = { id: 'u1', full_name: null, email: 'a@test.co', phone: null, role: 'admin', company: null, notes: null }
    expect(auth.isAdmin).toBe(true)
  })
})
