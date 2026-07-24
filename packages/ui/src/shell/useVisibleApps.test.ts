import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@fsparts/core'
import { useVisibleApps } from './useVisibleApps'

describe('useVisibleApps', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('excludes admin-only apps when the user is not an admin', () => {
    const { visibleApps } = useVisibleApps()
    expect(visibleApps.value.map((a) => a.id)).toEqual(['shop', 'calculator'])
  })

  it('includes admin-only apps when isAdmin is true', () => {
    const auth = useAuthStore()
    auth.profile = { id: 'u1', full_name: null, email: 'a@test.co', phone: null, role: 'admin', company: null, notes: null }
    const { visibleApps } = useVisibleApps()
    expect(visibleApps.value.map((a) => a.id)).toEqual(['shop', 'calculator', 'dashboard'])
  })
})
