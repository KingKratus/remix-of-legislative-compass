import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

export function exportAnalisesCsv(
  analises: Analise[],
  ano: number,
  filters?: { partido?: string; uf?: string; classificacao?: string; regiao?: string }
) {
  const header = "Nome,Partido,UF,Score,Votos Úteis,Votos Alinhados,Classificação,Ano";
  const rows = analises.map((a) =>
    [
      `"${(a.deputado_nome || "").replace(/"/g, '""')}"`,
      a.deputado_partido || "",
      a.deputado_uf || "",
      Number(a.score).toFixed(2),
      a.total_votos,
      a.votos_alinhados,
      a.classificacao,
      a.ano,
    ].join(",")
  );

  const csv = [header, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  const parts = [`ano-${ano}`];
  if (filters?.partido && filters.partido !== "all") parts.push(`partido-${filters.partido}`);
  if (filters?.uf && filters.uf !== "all") parts.push(`uf-${filters.uf}`);
  if (filters?.classificacao && filters.classificacao !== "all") parts.push(`class-${filters.classificacao}`);
  if (filters?.regiao && filters.regiao !== "all") parts.push(`regiao-${filters.regiao}`);

  link.href = url;
  link.download = `monitor-legislativo-${parts.join("_")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
