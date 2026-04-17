// Supabase Storage helper — substitui @vercel/blob.
// Usa o mesmo projeto Supabase das tabelas squad_*/szs_*/mktp_* (SQUAD_SUPABASE_URL).
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const BUCKET = process.env.BLOB_BUCKET || "app-data"
const SUPABASE_URL = process.env.SQUAD_SUPABASE_URL || "https://cncistmevwwghtaiyaao.supabase.co"
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

let cached: SupabaseClient | null = null
function client(): SupabaseClient {
  if (!cached) {
    if (!SERVICE_ROLE_KEY) throw new Error("[blob-storage] SUPABASE_SERVICE_ROLE_KEY ausente")
    cached = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return cached
}

export async function getBlob<T = unknown>(path: string): Promise<T | null> {
  try {
    const { data, error } = await client().storage.from(BUCKET).download(path)
    if (error || !data) return null
    const text = await data.text()
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function putBlob(path: string, data: string): Promise<void> {
  const { error } = await client().storage.from(BUCKET).upload(path, data, {
    contentType: "application/json",
    upsert: true,
  })
  if (error) throw new Error(`[blob-storage] upload ${path} falhou: ${error.message}`)
}
