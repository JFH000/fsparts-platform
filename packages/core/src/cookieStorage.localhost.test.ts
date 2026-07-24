// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { createSessionStorage } from './cookieStorage'

describe('createSessionStorage on localhost', () => {
  it('falls back to window.localStorage and round-trips values', () => {
    const storage = createSessionStorage('localhost')
    storage.setItem('sb-test-auth-token', 'abc123')
    expect(storage.getItem('sb-test-auth-token')).toBe('abc123')
    expect(window.localStorage.getItem('sb-test-auth-token')).toBe('abc123')
    storage.removeItem('sb-test-auth-token')
    expect(storage.getItem('sb-test-auth-token')).toBeNull()
  })
})
