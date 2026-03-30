# Resultados SZS — Design Spec

Nova aba "Resultados SZS" no dropdown "Resultados" do header, exibindo resultados mensais do módulo Seazone Serviços por macro-canal.

## Macro-canais

Três macro-canais agrupam os canal_groups do Pipedrive (pipeline 14):

| Macro-canal | Canal Groups incluídos | IDs |
|-------------|----------------------|-----|
| **Vendas Diretas** | Marketing, Mônica, Spots, Outros | 12, 4551, 3189, fallback |
| **Parceiros** | Parceiros (indicação corretor/franqueado) | 582, 583 |
| **Expansão** | Expansão | 1748 |

Cada canal mostra um tooltip ⓘ no header com o filtro exato aplicado no banco.

## Layout por canal

Cada macro-canal é um card com:

### Header
- Nome do canal com ícone (🎯/🤝/🚀)
- `(real/meta contratos) — LM: X` (contratos do mês anterior)
- Tooltip ⓘ com filtro de banco

### Corpo (grid 50/50)

**Coluna esquerda — Barras de progresso (real/meta):**

| Métrica | Vendas Diretas | Parceiros | Expansão |
|---------|---------------|-----------|----------|
| Orçamento | R$ 76.500 | — | — |
| Leads | 2.500 | — | — |
| MQL | 1.639 | 249 | 1.832 |
| SQL | 674 | 154 | 566 |
| OPP | 328 | 140 | 216 |
| Ganhos (WON) | 98 | 73 | 95 |

Cores por % de atingimento:
- ≥80%: verde (#22c55e)
- 60-79%: azul (#3b82f6)
- 40-59%: laranja (#f97316)
- <40%: vermelho (#ef4444)

Métricas sem meta (ex: Orçamento para Parceiros) não aparecem.

**Coluna direita — Gráficos empilhados:**

1. **Deals Abertos no Funil** — gráfico de área mostrando total de deals abertos ao longo do tempo. Toggle 30d/60d/90d.
2. **Deals por Etapa** — gráfico de linhas mostrando evolução por etapa (MQL, SQL, OPP, WON). Ag.Dados e Contrato em linhas tracejadas.

### Rodapé (3 boxes full-width)

| Box | Fonte | Descrição |
|-----|-------|-----------|
| **Aguardando Dados** | `szs_deals` (stage "Ag. Dados") | Snapshot: deals nessa etapa agora |
| **Em Contrato** | `szs_deals` (stage "Contrato") | Snapshot: deals nessa etapa agora |
| **Ocupação Agenda** | `szs_deals` (stage "Agendado") | Reuniões agendadas 7d ÷ capacidade |

### Cálculo Ocupação Agenda

```
capacidade = closers_do_canal × 16 reuniões/dia × 5 dias = slots/semana
ocupação = reuniões_agendadas_7d / capacidade × 100
```

Closers por canal vêm do config dos squads em `modules.ts`.

## Metas

Hardcoded por mês × macro-canal, similar ao `SZS_METAS_WON` existente:

```typescript
const SZS_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { orcamento: 76500, leads: 2500, mql: 1639, sql: 674, opp: 328, won: 98 },
    "Parceiros":      { mql: 249, sql: 154, opp: 140, won: 73 },
    "Expansão":       { mql: 1832, sql: 566, opp: 216, won: 95 },
  },
};
```

**LM (Last Month):** valor de WON do mês anterior, da mesma fonte (`szs_daily_counts`).

## Fontes de dados

| Dado | Tabela | Query |
|------|--------|-------|
| Contagens funil (MQL/SQL/OPP/WON) | `szs_daily_counts` | `tab` + `canal_group` + mês atual |
| Leads | `szs_daily_counts` | tab=mql (ou baserow leads se disponível) |
| Orçamento (spend real) | `szs_meta_ads` | `spend_month` agregado por canal |
| Snapshots (Ag.Dados, Contrato) | `szs_deals` | `status=open` + `stage_order` específico |
| Ocupação agenda | `szs_deals` | `status=open` + `stage_order` de "Agendado" + `next_activity_date` 7d |
| Evolução deals abertos | `szs_daily_counts` | Últimos 30/60/90 dias por canal |
| LM (last month) | `szs_daily_counts` | tab=won + mês anterior |

## Arquitetura

### API Route
`/api/szs/resultados` — nova rota que retorna:

```typescript
interface ResultadosSZSData {
  month: string; // "2026-03"
  channels: ChannelResult[];
}

interface ChannelResult {
  name: string; // "Vendas Diretas" | "Parceiros" | "Expansão"
  filterDescription: string; // tooltip text com filtro do banco
  metrics: {
    orcamento?: { real: number; meta: number };
    leads?: { real: number; meta: number };
    mql: { real: number; meta: number };
    sql: { real: number; meta: number };
    opp: { real: number; meta: number };
    won: { real: number; meta: number };
  };
  lastMonthWon: number;
  snapshots: {
    aguardandoDados: number;
    emContrato: number;
  };
  ocupacaoAgenda: {
    agendadas: number;
    capacidade: number;
    percent: number;
  };
  dealsHistory: {
    date: string;
    total: number;
    byStage: Record<string, number>; // mql, sql, opp, won, ag_dados, contrato
  }[];
}
```

### View Component
`src/components/dashboard/resultados-szs-view.tsx`

- Recebe `ResultadosSZSData` + `loading` + `lastUpdated`
- Renderiza 3 cards (um por macro-canal)
- Gráficos SVG inline (pattern existente no projeto)
- Inline styles com tokens de `T` (constants.ts)

### Header
Adicionar "Resultados SZS" ao dropdown "Resultados" em `header.tsx`:
- View key: `"resultados-szs"`
- Label: "Resultados SZS"
- Icon: BarChart3 ou similar
- Só visível quando módulo ativo é SZS

### page.tsx
- Importar `ResultadosSZSView`
- Adicionar fetch para `/api/szs/resultados`
- Adicionar case no render

## Mapping canal_group → macro-canal

```typescript
const MACRO_CHANNELS: Record<string, string> = {
  "Marketing": "Vendas Diretas",
  "Mônica": "Vendas Diretas",
  "Spots": "Vendas Diretas",
  "Outros": "Vendas Diretas",
  "Parceiros": "Parceiros",
  "Expansão": "Expansão",
};
```

## Convenções seguidas
- Código em inglês, UI em português
- Inline styles com tokens T
- Dados sempre do Supabase
- Paginação via `paginate()` de `src/lib/paginate.ts`
- Gráficos SVG customizados (sem recharts)
