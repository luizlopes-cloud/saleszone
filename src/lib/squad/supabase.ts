// Helper Supabase para módulos squad (isolado do saleszone)
// Usa as env vars padrão do Next.js (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { createClient } from '@supabase/supabase-js'

// squad_* / mktp_* tables live in the squad Supabase project, NOT the main saleszone project.
const SQUAD_SUPABASE_URL = "https://cncistmevwwghtaiyaao.supabase.co";

export function createSquadSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    console.warn('[squad/supabase] SUPABASE_SERVICE_ROLE_KEY não encontrada — usando anon key como fallback. Tabelas com RLS retornarão vazio.')
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!anonKey) throw new Error('Nem SERVICE_ROLE_KEY nem ANON_KEY configuradas')
    return createClient(SQUAD_SUPABASE_URL, anonKey)
  }
  return createClient(SQUAD_SUPABASE_URL, key)
}

/** Returns true if service role key is available (squad_deals accessible) */
export function hasServiceRole(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}
