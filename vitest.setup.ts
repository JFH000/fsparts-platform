class IntersectionObserverStub {
  constructor(_callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {}
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return [] }
  root = null
  rootMargin = ''
  thresholds: ReadonlyArray<number> = []
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = IntersectionObserverStub as unknown as typeof IntersectionObserver
}

function matchMediaStub(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() { return false },
  } as unknown as MediaQueryList
}

if (typeof globalThis.window !== 'undefined' && typeof globalThis.window.matchMedia === 'undefined') {
  globalThis.window.matchMedia = matchMediaStub as unknown as typeof window.matchMedia
}

if (typeof globalThis.SVGElement !== 'undefined' && typeof globalThis.SVGElement.prototype.getTotalLength === 'undefined') {
  globalThis.SVGElement.prototype.getTotalLength = function getTotalLength() { return 100 }
}
