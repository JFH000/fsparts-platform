const COOKIE_DOMAIN = '.fsparts.org'
const APEX_DOMAIN = 'fsparts.org'

export interface CookieStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function shouldUseCookies(hostname: string): boolean {
  return hostname === APEX_DOMAIN || hostname.endsWith(COOKIE_DOMAIN)
}

function readCookie(name: string): string | null {
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

function writeCookie(name: string, value: string): void {
  const maxAgeSeconds = 60 * 60 * 24 * 100
  document.cookie = `${name}=${encodeURIComponent(value)}; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=${maxAgeSeconds}; Secure; SameSite=Lax`
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; Domain=${COOKIE_DOMAIN}; Path=/; Max-Age=0; Secure; SameSite=Lax`
}

const cookieStorage: CookieStorage = {
  getItem: readCookie,
  setItem: writeCookie,
  removeItem: deleteCookie,
}

export function createSessionStorage(hostname: string = window.location.hostname): CookieStorage {
  return shouldUseCookies(hostname) ? cookieStorage : window.localStorage
}
