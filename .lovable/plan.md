## Plano: Anos 2019–2026, partido dinâmico por ano e validação

### Contexto

- Filtro de ano hoje: `ANOS = [2023, 2024, 2025, 2026]` em `Navbar.tsx`. Precisa virar `[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]`.
- A `auto-sync` já roda em loop por ano — basta passar a lista expandida.
- A `sync-camara` exige role `admin`. O usuário atual já foi promovido na migration anterior, então o 403 não deve mais ocorrer ao chamar com sessão válida.
- O cartão do deputado (`DeputyCard`) hoje mostra `deputado.siglaPartido` vindo da **API "deputados ativos"** — ou seja, sempre o partido **atual**, mesmo quando o usuário está vendo o ano de 2019. Isso é a raiz do bug de "partido errado em ano antigo".
- Já temos `analises_deputados.deputado_partido` com o partido capturado **no momento dos votos daquele ano** — esse é o dado correto para exibir por ano.

### 1. Expandir filtro de anos para 2019–2026

**`src/components/Navbar.tsx`**
- Trocar `const ANOS = [2023, 2024, 2025, 2026]` por `[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]` (ordem decrescente para UX).

**`supabase/functions/auto-sync/index.ts`**
- Trocar `const years = [2023, 2024, 2025, 2026]` por `[2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]`.

**Default de exibição:** continua `new Date().getFullYear()` (2026), conforme já implementado em `Index.tsx`.

### 2. Disparar sync histórico de 2019–2026

Após o deploy da `auto-sync` atualizada, chamar a função uma vez via tool `supabase--curl_edge_functions` para iniciar a sincronização sequencial dos 8 anos. O progresso aparece no `SyncLogPanel` (já existente). Anos sem orientação do governo retornam `done` rapidamente — comportamento já tratado.

Observação: a Câmara só tem `votacoesOrientacoes-XXXX.json` a partir de 2003, então 2019–2026 estão garantidos.

### 3. Partido dinâmico por ano (correção do bug central)

**Problema:** `Index.tsx` usa `deputados` (API ativa) como fonte primária e só consulta `analiseMap[id]` para score. O cartão exibe sempre o partido atual.

**Solução:** Quando há `analise` para aquele deputado/ano, exibir `analise.deputado_partido` em vez de `deputado.siglaPartido`. O mesmo vale para foto, nome e UF — todos já são gravados em `analises_deputados` no momento do sync, refletindo o estado real daquele ano.

**Mudanças em `src/components/DeputyCard.tsx`:**
- Calcular `displayPartido = analise?.deputado_partido ?? deputado.siglaPartido`.
- Calcular `displayUf = analise?.deputado_uf ?? deputado.siglaUf`.
- Calcular `displayFoto = analise?.deputado_foto ?? deputado.urlFoto`.
- Calcular `displayNome = analise?.deputado_nome ?? deputado.nome`.

**Mudanças em `src/pages/Index.tsx`:**
- Filtro por partido também precisa usar `analiseMap[d.id]?.deputado_partido ?? d.siglaPartido` para coincidir com o que é exibido.
- Lista de partidos do `<Select>` no `Navbar` hoje vem de `useDeputados()` (apenas partidos atuais). Para anos antigos, derivar a lista a partir de `analises` (siglas distintas no ano selecionado), unindo com a lista atual quando o ano corrente.

**`src/hooks/useDeputados.ts`** — sem mudança; ele continua sendo a fonte para deputados em mandato (necessário para listar quem aparece quando ainda não há análise).

**Mostrar histórico completo (não só ativos):** Para anos antigos, alguns deputados que tiveram votos não estão mais na Câmara. Solução: mesclar `deputados` (API) com os `deputado_id` presentes em `analises` daquele ano (`analiseMap`). Para os que só existem em `analises`, montar um objeto `Deputado` virtual a partir dos campos `deputado_*`.

Implementar essa fusão em `Index.tsx` no `useMemo` antes de filtrar:
```ts
const allDeputies = useMemo(() => {
  const byId = new Map<number, Deputado>();
  deputados.forEach(d => byId.set(d.id, d));
  analises.forEach(a => {
    if (!byId.has(a.deputado_id)) {
      byId.set(a.deputado_id, {
        id: a.deputado_id,
        nome: a.deputado_nome,
        siglaPartido: a.deputado_partido ?? "",
        siglaUf: a.deputado_uf ?? "",
        urlFoto: a.deputado_foto ?? "",
      });
    }
  });
  return Array.from(byId.values());
}, [deputados, analises]);
```

### 4. Lista de partidos dinâmica no filtro

Em `Index.tsx`, derivar `partidosDisponiveis` a partir das siglas distintas em `analises` do ano atual, ordenadas alfabeticamente. Passar ao `Navbar` no lugar de `partidos`. Para o ano corrente, fazer união com `partidos` da API (caso ainda não tenha sync). Isto remove automaticamente partidos extintos de anos passados e adiciona partidos antigos quando o usuário olha 2019, sem nenhum script externo de manutenção.

### 5. Validação Mapa + Dark Mode + 403

- Abrir preview, alternar tema (botão Sun/Moon) e verificar contraste em Mapa, Insights e cards.
- Abrir aba Mapa, confirmar que estados renderizam coloridos (depende de `analises[].deputado_uf`).
- Clicar no botão de sincronizar e confirmar via console/network que retorna `200` em vez de `403` (usuário já é admin).

### Detalhes técnicos

**Arquivos editados:**
- `src/components/Navbar.tsx` — `ANOS` expandido; partidos agora vêm via prop derivada (mantém prop atual, apenas valor passado muda).
- `src/pages/Index.tsx` — fusão deputados+analises, partido dinâmico no filtro, lista de partidos derivada por ano.
- `src/components/DeputyCard.tsx` — usar campos da `analise` quando presente.
- `supabase/functions/auto-sync/index.ts` — array de anos `[2019..2026]`.

**Sem mudanças no banco** (campos já existem em `analises_deputados`).

**Sem script extra de "verificação de partido":** A própria estrutura `(deputado_id, ano)` em `analises_deputados` registra o partido **no contexto do ano**, e o sync já preenche isso a partir da resposta `/votacoes/{id}/votos` da API da Câmara. Cada novo sync sobrescreve o partido correto daquele ano via `upsert` em `(deputado_id, ano)`. Logo, "trocas de partido" são tratadas automaticamente — basta usar o campo certo no front, que é o coração desta correção.

**Após o plano aprovado:** rodar a `auto-sync` uma vez para popular 2019–2022 e checar `sync_logs` no painel.
