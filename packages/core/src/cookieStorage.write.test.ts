// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createSessionStorage } from './cookieStorage'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cookieStorage on an *.fsparts.org hostname', () => {
  it('setItem writes a cookie string with the required domain/path/security attributes', () => {
    const storage = createSessionStorage('fsparts.org')
    const setSpy = vi.spyOn(document, 'cookie', 'set')

    storage.setItem('sb-test-auth-token', 'abc123')

    expect(setSpy).toHaveBeenCalledTimes(1)
    const written = setSpy.mock.calls[0][0]
    expect(written).toContain('sb-test-auth-token=abc123')
    expect(written).toContain('Domain=.fsparts.org')
    expect(written).toContain('Path=/')
    expect(written).toMatch(/Max-Age=\d+/)
    expect(written).toContain('Secure')
    expect(written).toContain('SameSite=Lax')
  })

  it('removeItem writes an immediately-expiring cookie with the same domain scoping', () => {
    const storage = createSessionStorage('fsparts.org')
    const setSpy = vi.spyOn(document, 'cookie', 'set')

    storage.removeItem('sb-test-auth-token')

    expect(setSpy).toHaveBeenCalledTimes(1)
    const written = setSpy.mock.calls[0][0]
    expect(written).toContain('sb-test-auth-token=')
    expect(written).toContain('Domain=.fsparts.org')
    expect(written).toContain('Max-Age=0')
  })

  it('getItem decodes a value previously written to document.cookie', () => {
    const storage = createSessionStorage('fsparts.org')
    // Written directly (not via storage.setItem) so this test proves the
    // parse/decode path independently of the write path above. Domain is
    // omitted here since jsdom does not reliably honor Domain=.fsparts.org
    // on a non-matching test origin — this test targets readCookie's
    // parsing logic, not the browser's cookie-jar domain matching.
    document.cookie = `sb-test-auth-token=${encodeURIComponent('value with spaces')}`

    expect(storage.getItem('sb-test-auth-token')).toBe('value with spaces')
  })

  it('getItem returns null for a key that was never set', () => {
    const storage = createSessionStorage('fsparts.org')
    expect(storage.getItem('sb-never-set')).toBeNull()
  })
})
