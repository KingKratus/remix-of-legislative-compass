

## Plano: Dark Mode, Mapa SVG do Brasil, Teste E2E, e Execução do Sync

### 1. Dark Mode com Toggle no Navbar

O projeto já tem tudo preparado: `next-themes` instalado, `darkMode: ["class"]` no Tailwind, e variáveis CSS `.dark` definidas no `index.css`. Falta apenas:

- **Criar `src/hooks/useTheme.ts`** (ou usar direto do `next-themes`)
- **Envolver o App com `ThemeProvider`** em `src/App.tsx`
- **Adicionar botão Sun/Moon no Navbar** que chama `setTheme`

**Arquivos editados:**
- `src/App.tsx` — envolver com `<ThemeProvider attribute="class" defaultTheme="system" enableSystem>`
- `src/components/Navbar.tsx` — adicionar toggle Moon/Sun icon button

---

### 2. Mapa SVG do Brasil por Estado

Criar um componente `BrazilMap` que renderiza um SVG simplificado do Brasil com os 27 estados. Cada estado será colorido com base no score médio de governismo dos deputados daquele estado.

- **Criar `src/components/BrazilMap.tsx`** — SVG inline com paths para cada UF brasileira (27 estados)
- Cores: gradiente de vermelho (oposição) → azul (centro) → verde (governo) baseado no score médio
- Tooltip ao hover mostrando UF, score médio, total de deputados
- Integrar como nova aba "Mapa" na página principal ou dentro da aba "Partidos"

**Dados:** Agrupar `analises_deputados` por `deputado_uf`, calcular média do score, aplicar cor

**Arquivos:**
- Criar `src/components/BrazilMap.tsx`
- Editar `src/pages/Index.tsx` — nova aba "Mapa" no TabsList

---

### 3. Teste E2E do Fluxo Completo

Usar as ferramentas de browser para testar manualmente:
1. Login com Google (verificar redirect e sessão)
2. Favoritar um deputado (verificar estrela preenchida)
3. Acessar `/perfil` (verificar favoritos listados)
4. Verificar aba Insights (gráficos renderizando)

Isso será feito na fase de implementação usando browser tools.

---

### 4. Executar Sync 2023-2026 e Default para Ano Atual

- **Deploy** da edge function `auto-sync` e **invocar manualmente** via `curl_edge_functions`
- **Ajustar o default do ano** em `Index.tsx`: usar `new Date().getFullYear()` em vez de `2025` hardcoded
- O auto-sync já processa anos `[2023, 2024, 2025, 2026]`

**Arquivo editado:**
- `src/pages/Index.tsx` — `useState(new Date().getFullYear())` para o ano

---

### Detalhes Técnicos

**ThemeProvider setup (App.tsx):**
```tsx
import { ThemeProvider } from "next-themes";
// Envolver todo o conteúdo com <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
```

**Toggle no Navbar:**
```tsx
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
// Botão que alterna entre "light" e "dark"
```

**BrazilMap:** SVG com 27 `<path>` elements, cada um com `data-uf` e cor dinâmica. Tooltip com `useState` para hover state. Paths dos estados serão baseados em coordenadas simplificadas do mapa brasileiro.

**Arquivos novos:** `src/components/BrazilMap.tsx`
**Arquivos editados:** `src/App.tsx`, `src/components/Navbar.tsx`, `src/pages/Index.tsx`
**Sem mudanças no banco de dados.**

