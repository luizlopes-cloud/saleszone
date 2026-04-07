# Gestao de Orcamento de Campanhas

Analisa o funil de TODOS os empreendimentos em comercializacao (ativos e inativos) e recomenda como distribuir o orcamento diario para maximizar vendas (WON), respeitando que mudancas bruscas prejudicam a performance.

## Dados a Coletar

Busque os dados diretamente do Supabase usando curl (o servidor local requer auth). Leia as credenciais do `.env.local` (`NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`).

Faca TODAS as chamadas em paralelo:

### 1. Funil historico completo (RPC)
```bash
curl -s "$URL/rest/v1/rpc/get_planejamento_counts" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"months_back": -1, "days_back": -1}'
```
Retorna `[{month, empreendimento, mql, sql, opp, won}]` — todos os meses, todos os empreendimentos.

### 2. Funil ultimos 90 dias (RPC)
```bash
curl -s "$URL/rest/v1/rpc/get_planejamento_counts" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"months_back": 12, "days_back": 90}'
```
Mesma estrutura, filtrado pelos ultimos 90 dias.

### 3. Orcamento atual
```bash
curl -s "$URL/rest/v1/squad_orcamento?mes=eq.YYYY-MM&select=*" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```
Retorna `[{mes, orcamento_total}]`.

### 4. Meta Ads do mes corrente (CUIDADO: paginar!)
**IMPORTANTE:** Supabase retorna no maximo 1000 rows por request. Sempre buscar com `Range: 0-49999` header E verificar se voltou tudo.
```bash
# Pagina 1
curl -s "$URL/rest/v1/squad_meta_ads?select=ad_id,empreendimento,spend_month,leads_month,effective_status&snapshot_date=eq.YYYY-MM-DD" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Range: 0-999" -H "Prefer: count=exact" -D /tmp/meta_headers.txt
# Verificar content-range no header; se total > 1000, buscar pagina 2 com Range: 1000-1999
```
Agregar por empreendimento: soma spend_month e leads_month, conta active/paused.

## Premissas Fundamentais

### Sobre mudancas de budget
- **NUNCA recomendar mudancas bruscas** (>20%) em campanhas ativas que ja tem WON. Mudancas bruscas desestabilizam o algoritmo do Meta e aumentam o CPW.
- Aumento maximo: **+20% por semana** para campanhas ativas.
- Reducao maxima: **-15% por semana** para campanhas ativas.
- Campanhas pausadas podem ser ativadas com budget inicial de ate R$400/dia.

### Sobre concentracao de budget
- Concentrar demais em poucos empreendimentos causa retornos decrescentes (CPW sobe).
- O objetivo e encontrar o equilibrio entre **eficiencia** (mais budget onde CPW e menor) e **diversificacao** (manter todos os empreendimentos gerando dados e oportunidades).
- Piso minimo: **R$300/dia** por empreendimento ativo. Nenhum empreendimento em comercializacao deve ficar com R$0.
- Teto maximo: **30%** do budget diario total para um unico empreendimento.

### Sobre amostras pequenas
- Empreendimentos com **menos de 50 MQL total** tem dados insuficientes para uma taxa de conversao confiavel.
- Nesses casos, usar taxa historica ou media da conta como referencia. NAO confiar em taxas de 22% com 9 MQL.
- Indicar sempre o nivel de confianca: ALTA (>200 MQL + WON), MEDIA (50-200 MQL), BAIXA (<50 MQL).

## Analise a Realizar

### Etapa 1 — Funil de TODOS os Empreendimentos

Para CADA empreendimento em comercializacao (squads 1, 2, 3), independente de ter campanha ativa ou nao:

1. Agregar funil 90 dias: MQL, SQL, OPP, WON (soma todos os meses da RPC 90d)
2. Agregar funil historico: MQL, SQL, OPP, WON (soma todos os meses da RPC all-time)
3. Calcular taxas: MQL→SQL, SQL→OPP, OPP→WON, MQL→WON
4. Comparar 90d vs historico: taxa melhorando, estavel ou piorando?
5. Identificar onde o funil quebra (qual etapa tem a maior queda)

### Etapa 2 — Estimativa de CPW por Empreendimento

**CPW = CPL / taxa_MQL_to_WON**

Para o CPL:
- Se o empreendimento tem gasto em Meta Ads no mes: usar `spend / leads` do mes
- Se nao tem gasto: usar CPL medio da conta (total spend / total leads)

Para a taxa MQL→WON (blend ponderado por amostra):
- Se 90d tem >= 100 MQL E WON > 0: **70% peso 90d**, 30% historico
- Se 90d tem >= 30 MQL: **50/50**
- Se 90d tem < 30 MQL: **20% peso 90d**, 80% historico
- Se 90d tem 0 WON mas historico tem WON: maximo 20% peso no 90d
- Se ambos tem 0 WON: usar media da conta como fallback

### Etapa 3 — Distribuicao do Orcamento Diario

O objetivo e **gastar TODO o orcamento ate o fim do mes**.

1. Calcular `budget_diario = (orcamento_total - gasto_atual) / dias_restantes`
2. Para emps com campanhas ativas E WON nos 90d ("performando"):
   - **Manter o budget atual** como base
   - Ajustar levemente (+/- 10-15%) em direcao ao alvo ideal
3. Para emps sem campanha ativa ou sem WON:
   - Distribuir o budget remanescente proporcionalmente a `1/CPW_estimado`
   - Ponderar pela confianca dos dados (emps com mais dados recebem mais)
4. Aplicar restricoes:
   - Piso: R$300/dia por empreendimento
   - Teto: 30% do budget diario total
   - Mudanca maxima: +20% / -15% por semana vs budget atual
5. **Soma de todos os budgets deve = budget_diario** (gastar tudo)

### Etapa 4 — Plano de Transicao

Como nao podemos ir do budget atual ao recomendado de uma vez:

- **Semana 1**: ajustar max 20% na direcao do alvo. Ativar pausados com R$300-400/dia.
- **Semana 2**: se CPW estavel, continuar ajustando. Se CPW subiu >15%, reverter.
- **Semana 3+**: consolidar. Emps reativados sem OPP em 30 dias → reduzir a piso.

## Formato da Resposta

### 1. Resumo Executivo
- Orcamento mensal, gasto atual, ritmo, projecao, budget diario restante
- Quantos emps tem campanha ativa vs quantos estao pausados

### 2. Analise do Funil — Todos os Empreendimentos
Para CADA empreendimento, mostrar:

```
▸ Nome (Squad X) — [ATIVO R$X/dia | PAUSADO]
  Funil 90d:  XXX MQL → XXX SQL (XX%) → XXX OPP (XX%) → XX WON (XX%)
  Funil hist: XXX MQL → XXX SQL (XX%) → XXX OPP (XX%) → XX WON (XX%)
  Taxa blend: X.XXX% | CPW estimado: R$ X.XXX | Confianca: ALTA/MEDIA/BAIXA
  Diagnostico: [onde o funil quebra, comparacao 90d vs hist]
```

Ordenar por CPW estimado (melhor primeiro).

### 3. Distribuicao Recomendada
Tabela com:
| Emp | Squad | CPW Est. | Budget Atual | Budget Recom. | Δ | WON Proj/Mes | Acao Sem 1 |

- Total deve = budget diario
- Mostrar WON projetado = (budget_recom * dias_mes) / CPW_est
- Comparar: "Distribuicao atual → X WON/mes | Recomendada → Y WON/mes"

### 4. Plano Semana 1
Lista pratica do que fazer AGORA:
- Quais emps ativar e com quanto
- Quais emps ajustar e em quanto
- Quais emps manter

### 5. Alertas
- Emps com dados insuficientes (indicar risco)
- Emps com funil quebrado (muita MQL mas 0 WON)
- Emps gastando muito sem resultado

## Empreendimentos em Comercializacao

Consultar `src/lib/constants.ts` para a lista atualizada. Atualmente:
- **Squad 1**: Ponta das Canas Spot II, Itacare Spot, Marista 144 Spot
- **Squad 2**: Natal Spot, Novo Campeche Spot II, Caragua Spot, Bonito Spot II
- **Squad 3**: Jurere Spot II, Jurere Spot III, Barra Grande Spot, Vistas de Anita II

**Excluir da analise** qualquer empreendimento que o usuario pedir (ex: "menos Marista e Caragua").

## Notas Tecnicas
- Usar `source .env.local` para carregar as variaveis
- Supabase retorna MAX 1000 rows por default — SEMPRE paginar com header `Range` e verificar `content-range`
- Valores monetarios em BRL (R$)
- RPCs `get_planejamento_counts` filtram: pipeline SZI (28), canal Marketing, rd_source contem "paga", motivo de perda ≠ "Duplicado/Erro"
- Para snapshot_date do Meta Ads: usar o mais recente (order desc, limit 1)
- Se Supabase retornar 503/500, tentar novamente apos alguns segundos (instabilidade temporaria)
