import { supabase } from '@fsparts/core'
import type { UserRole } from '@fsparts/core'

export interface CustomerRow {
  id:         string
  email:      string
  full_name:  string | null
  phone:      string | null
  company:    string | null
  role:       UserRole
  notes:      string | null
  created_at: string
}

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function listCustomers(opts?: {
  search?: string
  role?:   UserRole | 'all'
}): Promise<CustomerRow[]> {
  let q = getSb()
    .from('user_profiles')
    .select('id, email, full_name, phone, company, role, notes, created_at')
    .order('created_at', { ascending: false })

  if (opts?.search?.trim()) {
    const s = `%${opts.search.trim()}%`
    q = q.or(`full_name.ilike.${s},email.ilike.${s},company.ilike.${s}`)
  }

  if (opts?.role && opts.role !== 'all') {
    q = q.eq('role', opts.role)
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CustomerRow[]
}

export async function updateCustomerRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await getSb()
    .from('user_profiles')
    .update({ role })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateCustomerNotes(userId: string, notes: string): Promise<void> {
  const { error } = await getSb()
    .from('user_profiles')
    .update({ notes })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}
