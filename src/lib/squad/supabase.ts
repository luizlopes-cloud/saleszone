// Helper Supabase para módulos squad (isolado do saleszone)
// Tabelas squad_*/mktp_*/szs_* vivem em projeto separado (cncistmevwwghtaiyaao)
import { createClient } from '@supabase/supabase-js'

// Default pro projeto antigo que já funciona (fallback se env var não configurada)
const SQUAD_SUPABASE_URL = process.env.SQUAD_SUPABASE_URL || "https://cncistmevwwghtaiyaao.supabase.co";

export function createSquadSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    console.warn('[squad/supabase] SUPABASE_SERVICE_ROLE_KEY não encontrada — usando anon key como fallback. Tabelas com RLS retornarão vazio.')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!anonKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY e ANON_KEY não configuradas')
    return createClient(SQUAD_SUPABASE_URL, anonKey)
  }
  return createClient(SQUAD_SUPABASE_URL, key)
}

/** Returns true if service role key is available (squad_deals accessible) */
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}