import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthModal } from '../useAuthModal'

describe('useAuthModal', () => {
  const { mode, open, close, switchTo } = useAuthModal()

  beforeEach(() => close())

  it('starts closed', () => {
    expect(mode.value).toBeNull()
  })

  it('open sets the given mode', () => {
    open('login')
    expect(mode.value).toBe('login')
  })

  it('close resets mode to null', () => {
    open('login')
    close()
    expect(mode.value).toBeNull()
  })

  it('switchTo changes mode without closing', () => {
    open('login')
    switchTo('register')
    expect(mode.value).toBe('register')
  })

  it('switchTo from null sets mode', () => {
    switchTo('onboarding')
    expect(mode.value).toBe('onboarding')
  })
})
