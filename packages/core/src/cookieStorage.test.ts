import { describe, it, expect } from 'vitest'
import { shouldUseCookies } from './cookieStorage'

describe('shouldUseCookies', () => {
  it('is true for the apex domain', () => {
    expect(shouldUseCookies('fsparts.org')).toBe(true)
  })

  it('is true for any *.fsparts.org subdomain', () => {
    expect(shouldUseCookies('shop.fsparts.org')).toBe(true)
    expect(shouldUseCookies('calculator.fsparts.org')).toBe(true)
    expect(shouldUseCookies('dashboard.fsparts.org')).toBe(true)
  })

  it('is false for localhost', () => {
    expect(shouldUseCookies('localhost')).toBe(false)
  })

  it('is false for a domain that merely ends with the substring "fsparts.org"', () => {
    expect(shouldUseCookies('evilfsparts.org')).toBe(false)
  })
})
