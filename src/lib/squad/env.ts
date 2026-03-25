// Variáveis de ambiente para módulos squad (Pipedrive direto)
// Separado do env principal do saleszone para não conflitar
export const squadEnv = {
  PIPEDRIVE_API_TOKEN: process.env.PIPEDRIVE_API_TOKEN!,
  PIPEDRIVE_COMPANY_DOMAIN: process.env.PIPEDRIVE_COMPANY_DOMAIN || 'seazone-fd92b9',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN!,
  META_AD_ACCOUNT_ID: process.env.META_AD_ACCOUNT_ID!,
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  API4COM_TOKEN: process.env.API4COM_TOKEN || '',
}
