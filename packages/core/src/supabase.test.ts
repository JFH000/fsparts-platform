// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ mocked: true })),
}))

import { createClient } from '@supabase/supabase-js'
import { createSupabaseClient } from './supabase'

describe('createSupabaseClient', () => {
  it('passes url, anonKey, and a storage adapter into createClient', () => {
    createSupabaseClient({ url: 'https://test.supabase.co', anonKey: 'test-key' })

    expect(createClient).toHaveBeenCalledTimes(1)
    const [url, anonKey, options] = vi.mocked(createClient).mock.calls[0]
    expect(url).toBe('https://test.supabase.co')
    expect(anonKey).toBe('test-key')
    expect(options?.auth?.storage?.getItem).toBeTypeOf('function')
    expect(options?.auth?.storage?.setItem).toBeTypeOf('function')
    expect(options?.auth?.storage?.removeItem).toBeTypeOf('function')
  })
})
