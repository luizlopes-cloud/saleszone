// Helper Supabase para módulos squad (isolado do saleszone)
// Usa as env vars padrão do Next.js (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from '@supabase/supabase-js'

export function createSquadSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada')
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY não encontrada — usando anon key como fallback. Tabelas com RLS (squad_deals, nekt_meta26_metas) retornarão vazio.')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!anonKey) throw new Error('Nem SERVICE_ROLE_KEY nem ANON_KEY configuradas')
    return createClient(url, anonKey)
  }
  return createClient(url, key)
}

/** Returns true if service role key is available (squad_deals accessible) */
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}
