

## Plano: Sync completo, Perfil com favoritos, Insights de tendências e Mapa por UF

### Diagnóstico atual

**Bugs identificados:**
1. **Navbar ANOS** = `[2024, 2025, 2026]` -- falta 2023
2. **auto-sync nunca executou** -- zero logs. O cron job está configurado mas usa `anon key` no header; a função não requer auth, então deve funcionar na próxima execução às 03:00 UTC
3. **Dados no banco**: 2024 (543), 2025 (551), 2026 (512) -- 2023 está vazio
4. **Página de perfil não existe** -- a tabela `profiles` já tem coluna `favoritos` (integer[]) mas não há UI
5. **Nenhuma aba de Insights/Tendências** no frontend

---

### 1. Corrigir e testar auto-sync (2023-2026)

- Atualizar `auto-sync` para processar anos `[2023, 2024, 2025, 2026]` (já faz isso, mas confirmar)
- Deploiar e invocar manualmente via `curl_edge_functions` para validar
- Corrigir Navbar: ANOS = `[2023, 2024, 2025, 2026]`

### 2. Log de progresso do sync (seguro)

Criar uma tabela `sync_logs` para registrar o progresso:
- Colunas: `id`, `ano`, `status` (running/done/error), `votacoes_processadas`, `deputados_atualizados`, `started_at`, `finished_at`, `message`
- RLS: SELECT público (read-only), INSERT/UPDATE bloqueado (apenas service role)
- O auto-sync e sync-camara gravam progresso nessa tabela
- Frontend: componente `SyncLogPanel` no sidebar que mostra últimas execuções com timestamps -- sem expor detalhes técnicos internos (sem stack traces, sem IDs de votação)

### 3. Filtro geográfico por UF com regiões do Brasil

Em vez de GeoJSON pesado (mapa SVG/Canvas), usar agrupamento por **região geográfica** (Norte, Nordeste, Centro-Oeste, Sudeste, Sul) derivado da UF:
- Adicionar filtro de região no Navbar (Select com as 5 regiões)
- Mapping estático UF -> Região (ex: SP -> Sudeste, BA -> Nordeste)
- Filtrar deputados pela região selecionada
- Na aba Partidos, mostrar breakdown por região

### 4. Aba Perfil com favoritos

- Nova rota `/perfil`
- Hook `useProfile` para carregar/atualizar favoritos via tabela `profiles`
- Botão de favoritar (estrela) no `DeputyCard` e `DeputyDetail`
- Página de perfil mostra: avatar Google, nome, lista de deputados favoritados com seus scores
- Link no Navbar (ícone de usuário quando logado)

### 5. Aba Insights / Tendências

Nova aba "Insights" na página principal com:

**a) Tendência por classificação (Centro → para onde está indo)**
- Comparar scores entre anos disponíveis (2023 vs 2024 vs 2025 vs 2026)
- Para deputados classificados como "Centro", calcular se o score está subindo (→ Governo) ou descendo (→ Oposição)
- Mostrar com setas e badges: "Centro → tendência Governo" ou "Centro → tendência Oposição"

**b) Movimentação da base**
- Gráfico de barras empilhadas mostrando quantos deputados migraram de classificação entre anos
- Ex: "23 deputados saíram de Centro para Governo em 2025"

**c) Score médio por ano**
- Line chart com a evolução do score médio geral por ano

---

### Detalhes técnicos

**Database migration:**
```sql
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  status text NOT NULL DEFAULT 'running',
  votacoes_processadas integer DEFAULT 0,
  deputados_atualizados integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  message text
);
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync logs publicly readable" ON public.sync_logs FOR SELECT USING (true);
CREATE POLICY "No public insert" ON public.sync_logs FOR INSERT WITH CHECK (false);
CREATE POLICY "No public update" ON public.sync_logs FOR UPDATE USING (false);
```

**Novos arquivos:**
- `src/pages/Profile.tsx` -- página de perfil + favoritos
- `src/hooks/useProfile.ts` -- CRUD favoritos
- `src/hooks/useSyncLogs.ts` -- leitura dos logs de sync
- `src/components/InsightsPanel.tsx` -- aba de tendências com charts
- `src/components/SyncLogPanel.tsx` -- painel de logs no sidebar
- `src/lib/regioesUf.ts` -- mapping UF → região

**Arquivos editados:**
- `src/App.tsx` -- adicionar rota `/perfil`
- `src/components/Navbar.tsx` -- ANOS=[2023-2026], filtro região, link perfil
- `src/pages/Index.tsx` -- aba Insights, filtro região, botão favoritar
- `src/components/DeputyCard.tsx` -- botão favoritar
- `supabase/functions/auto-sync/index.ts` -- gravar em sync_logs
- `supabase/functions/sync-camara/index.ts` -- gravar em sync_logs

**Segurança do log:**
- Logs mostram apenas: ano, status, contagens numéricas, timestamps
- Sem IPs, tokens, stack traces, ou IDs de votação no frontend
- Tabela protegida por RLS (read-only público, write apenas service role)

