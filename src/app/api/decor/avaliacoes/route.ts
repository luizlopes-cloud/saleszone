// Decor — Avaliação de Reuniões (calendar events + Fireflies transcripts)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getModuleConfig } from "@/lib/modules";
import { paginate } from "@/lib/paginate";
import type { AvaliacaoReuniao, AvaliacaoCloserSummary, AvaliacoesData, AvaliacaoJSON } from "@/lib/types";

const mc = getModuleConfig("decor");

export const dynamic = "force-dynamic";

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function getSquadId(closerName: string): number {
  const n = norm(closerName);
  for (const sq of mc.squads) {
    const v = norm(sq.venda);
    if (n === v || n.includes(v) || v.includes(n)) return sq.id;
  }
  return 0;
}

const MIN_TRANSCRIPT_CHARS = 500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const daysBack = parseInt(url.searchParams.get("days") || "30", 10);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(supabaseUrl, supabaseKey);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startStr = startDate.toISOString().split("T")[0];
  const endStr = endDate.toISOString().split("T")[0];

  const allEvents = await paginate((o, ps) =>
    sb
      .from("decor_calendar_events")
      .select("id,titulo,dia,hora,closer_name,closer_email,empreendimento,fireflies_id,transcricao,avaliacao,diagnostico,cancelou,duracao_min")
      .gte("dia", startStr)
      .lte("dia", endStr)
      .order("dia", { ascending: false })
      .range(o, o + ps - 1),
  );

  const closerNorms = mc.closers.map(norm);
  const closerEvents = allEvents.filter((ev: any) => {
    if (ev.cancelou === true) return false;
    const name = norm(String(ev.closer_name || ""));
    return closerNorms.some((cn: string) => name.includes(cn) || cn.includes(name));
  });

  const reunioes: AvaliacaoReuniao[] = closerEvents.map((ev: any) => {
    const hasFireflies = !!ev.fireflies_id;
    const transcricao = ev.transcricao as string | null;
    const transcricaoChars = transcricao ? transcricao.length : 0;

    let avaliacaoObj: AvaliacaoJSON | null = null;
    if (ev.avaliacao) {
      try { avaliacaoObj = typeof ev.avaliacao === "string" ? JSON.parse(ev.avaliacao) : ev.avaliacao; } catch { /* ignore */ }
    }

    let invalidReason: string | null = null;
    if (!hasFireflies) invalidReason = "Sem gravação (Fireflies não encontrou transcrição)";
    else if (transcricaoChars > 0 && transcricaoChars < MIN_TRANSCRIPT_CHARS) invalidReason = `Transcrição muito curta (${transcricaoChars} caracteres)`;
    else if (transcricaoChars === 0 && hasFireflies) invalidReason = "Transcrição vazia ou alucinação detectada";
    else if (avaliacaoObj && avaliacaoObj.nota_final === 0) invalidReason = "Transcrição corrompida (áudio ilegível)";

    return {
      eventId: String(ev.id), titulo: String(ev.titulo || ""), dia: String(ev.dia || ""),
      hora: String(ev.hora || ""), closerName: String(ev.closer_name || ""),
      closerEmail: String(ev.closer_email || ""), empreendimento: ev.empreendimento as string | null,
      firefliesId: ev.fireflies_id as string | null, transcricaoChars,
      avaliacao: avaliacaoObj, diagnostico: ev.diagnostico as string | null,
      cancelou: ev.cancelou === true, duracaoMin: ev.duracao_min as number | null, invalidReason,
    };
  });

  const closerMap = new Map<string, AvaliacaoReuniao[]>();
  for (const r of reunioes) {
    const key = norm(r.closerName);
    if (!closerMap.has(key)) closerMap.set(key, []);
    closerMap.get(key)!.push(r);
  }

  const closers: AvaliacaoCloserSummary[] = [];
  for (const [, closerReunioes] of closerMap) {
    const name = closerReunioes[0].closerName;
    const squadId = getSquadId(name);
    const totalReunioes = closerReunioes.length;
    const validas = closerReunioes.filter((r) => !r.invalidReason);
    const invalidas = closerReunioes.filter((r) => !!r.invalidReason);
    const avaliadasReais = validas.filter((r) => r.avaliacao && r.avaliacao.nota_final > 0);

    let notaMedia: number | null = null;
    const pilarSums = { conhecimento_produto: 0, tecnicas_venda: 0, rapport_empatia: 0, foco_cta: 0, objetividade: 0 };
    if (avaliadasReais.length > 0) {
      let totalNota = 0;
      for (const r of avaliadasReais) {
        const a = r.avaliacao!;
        totalNota += a.nota_final;
        for (const k of Object.keys(pilarSums) as (keyof typeof pilarSums)[]) pilarSums[k] += a.pilares[k]?.nota ?? 0;
      }
      notaMedia = Math.round((totalNota / avaliadasReais.length) * 10) / 10;
    }

    const pilarAvg = avaliadasReais.length > 0
      ? Object.fromEntries(Object.entries(pilarSums).map(([k, v]) => [k, Math.round((v / avaliadasReais.length) * 10) / 10]))
      : Object.fromEntries(Object.keys(pilarSums).map((k) => [k, null]));

    closers.push({
      name, squadId, totalReunioes,
      transcricoesValidas: validas.length, transcricoesInvalidas: invalidas.length,
      reunioesAvaliadas: avaliadasReais.length, notaMedia, pilares: pilarAvg as any,
      reunioes: closerReunioes.sort((a, b) => b.dia.localeCompare(a.dia)),
    });
  }

  closers.sort((a, b) => {
    if (a.notaMedia == null && b.notaMedia == null) return 0;
    if (a.notaMedia == null) return 1;
    if (b.notaMedia == null) return -1;
    return b.notaMedia - a.notaMedia;
  });

  const allAvaliadas = closers.reduce((s, c) => s + c.reunioesAvaliadas, 0);
  const totalNota = closers.reduce((s, c) => s + (c.notaMedia ?? 0) * c.reunioesAvaliadas, 0);

  const result: AvaliacoesData = {
    closers,
    totals: {
      totalReunioes: reunioes.length,
      transcricoesValidas: reunioes.filter((r) => !r.invalidReason).length,
      transcricoesInvalidas: reunioes.filter((r) => !!r.invalidReason).length,
      reunioesAvaliadas: allAvaliadas,
      notaMedia: allAvaliadas > 0 ? Math.round((totalNota / allAvaliadas) * 10) / 10 : null,
    },
    periodo: { from: startStr, to: endStr },
  };

  return NextResponse.json(result);
}
