// Script to populate metas tables using curl directly
const SUPABASE_URL = 'https://iobxudcyihqfdwiggohz.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuY2lzdG1ldnd3Z2h0YWl5YWFvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzg1MDI5NywiZXhwIjoyMDg5NDI2Mjk3fQ.uaGNH8N5pPTBm5Rtch5oYWuTxXGVVQK8-tuZ50GzxXY';

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYnh1ZGN5aWhxZmR3aWdnb2h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE4NDMsImV4cCI6MjA4ODkyNzg0M30.BelWphFGytC583TK2Iunmf_Ah__yR-d7N_823OGd9j8';

const headers = {
  'apikey': SUPABASE_URL,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=minimal',
};

async function request(method, path, body) {
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, options);
  const text = await res.text();
  if (!res.ok) {
    console.error('Error:', text);
    throw new Error(text);
  }
  return text;
}

async function main() {
  // MKTP metas - annual 180 / 12 = 15 per month
  const mktpMetas = [];
  for (let i = 0; i < 12; i++) {
    const month = `2026-${String(i + 1).padStart(2, '0')}-01`;
    mktpMetas.push({ month, squad_id: 1, tab: 'won', meta: 15 });
  }

  // SZS metas by canal
  const SZS_ANNUAL = {
    Marketing: 647,
    Parceiros: 1079,
    Expansão: 251,
    Spots: 198,
    Outros: 285,
  };
  const CANAL_GROUP_ORDER = ['Marketing', 'Parceiros', 'Mônica', 'Expansão', 'Spots', 'Outros'];

  const szsMetas = [];
  for (let c = 0; c < CANAL_GROUP_ORDER.length; c++) {
    const canal = CANAL_GROUP_ORDER[c];
    const annual = SZS_ANNUAL[canal] || 0;
    const monthly = Math.round(annual / 12);
    for (let i = 0; i < 12; i++) {
      const month = `2026-${String(i + 1).padStart(2, '0')}-01`;
      szsMetas.push({ month, squad_id: c + 1, tab: 'won', meta: monthly });
    }
  }

  console.log('Populating MKTP metas...');
  await request('DELETE', 'mktp_metas', null);
  for (const m of mktpMetas) {
    await request('POST', 'mktp_metas', m);
  }
  console.log('Inserted', mktpMetas.length, 'MKTP metas');

  console.log('Populating SZS metas...');
  await request('DELETE', 'szs_metas', null);
  for (const m of szsMetas) {
    await request('POST', 'szs_metas', m);
  }
  console.log('Inserted', szsMetas.length, 'SZS metas');

  console.log('\nVerifying...');
  const mktpCheck = await request('GET', 'mktp_metas?limit=3', null);
  console.log('MKTP:', mktpCheck.slice(0, 200));

  const szsCheck = await request('GET', 'szs_metas?limit=3', null);
  console.log('SZS:', szsCheck.slice(0, 200));
}

main().catch(console.error);