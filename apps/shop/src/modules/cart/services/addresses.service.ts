import { supabase } from '@fsparts/core'
import type { ShippingAddress } from '@fsparts/core'

function getSb() {
  if (!supabase) throw new Error('Supabase no configurado')
  return supabase
}

export async function listAddresses(): Promise<ShippingAddress[]> {
  const { data, error } = await getSb()
    .from('shipping_addresses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ShippingAddress[]
}

export type NewAddress = Omit<ShippingAddress, 'id' | 'user_id' | 'created_at'>

export async function createAddress(userId: string, input: NewAddress): Promise<ShippingAddress> {
  const { data, error } = await getSb()
    .from('shipping_addresses')
    .insert({ user_id: userId, ...input })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as ShippingAddress
}

export async function deleteAddress(id: string): Promise<void> {
  const { error } = await getSb().from('shipping_addresses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
