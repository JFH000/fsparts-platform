import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createSessionStorage } from './cookieStorage'

export interface SupabaseConfig {
  url: string
  anonKey: string
}

export function createSupabaseClient(config: SupabaseConfig): SupabaseClient {
  return createClient(config.url, config.anonKey, {
    auth: { storage: createSessionStorage() },
  })
}
