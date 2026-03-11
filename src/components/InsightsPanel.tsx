import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Minus, ArrowRightLeft } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend,
} from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

const ANOS = [2023, 2024, 2025, 2026];

export function InsightsPanel() {
  const [allData, setAllData] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("analises_deputados")
        .select("*")
        .in("ano", ANOS)
        .order("ano", { ascending: true });
      setAllData(data || []);
      setLoading(false);
    }
    load();
  }, []);

  // Group by year
  const byYear = useMemo(() => {
    const map: Record<number, Analise[]> = {};
    for (const a of allData) {
      if (!map[a.ano]) map[a.ano] = [];
      map[a.ano].push(a);
    }
    return map;
  }, [allData]);

  // Average score per year
  const avgScoreData = useMemo(() => {
    return ANOS.map((ano) => {
      const items = byYear[ano] || [];
      const avg = items.length > 0
        ? items.reduce((s, a) => s + Number(a.score), 0) / items.length
        : 0;
      return { ano: String(ano), score: Math.round(avg * 100) / 100, count: items.length };
    }).filter((d) => d.count > 0);
  }, [byYear]);

  // Classification distribution per year
  const classDistData = useMemo(() => {
    return ANOS.map((ano) => {
      const items = byYear[ano] || [];
      return {
        ano: String(ano),
        Governo: items.filter((a) => a.classificacao === "Governo").length,
        Centro: items.filter((a) => a.classificacao === "Centro").length,
        "Oposição": items.filter((a) => a.classificacao === "Oposição").length,
      };
    }).filter((d) => d.Governo + d.Centro + d["Oposição"] > 0);
  }, [byYear]);

  // Centro trend analysis
  const centroTrends = useMemo(() => {
    const availableYears = ANOS.filter((y) => (byYear[y] || []).length > 0);
    if (availableYears.length < 2) return [];

    const latestYear = availableYears[availableYears.length - 1];
    const prevYear = availableYears[availableYears.length - 2];
    const latestMap: Record<number, Analise> = {};
    const prevMap: Record<number, Analise> = {};

    for (const a of byYear[latestYear] || []) latestMap[a.deputado_id] = a;
    for (const a of byYear[prevYear] || []) prevMap[a.deputado_id] = a;

    const trends: { nome: string; partido: string; prev: number; curr: number; delta: number; direction: string }[] = [];

    for (const [idStr, curr] of Object.entries(latestMap)) {
      const id = Number(idStr);
      const prev = prevMap[id];
      if (!prev) continue;
      if (curr.classificacao !== "Centro" && prev.classificacao !== "Centro") continue;

      const delta = Number(curr.score) - Number(prev.score);
      let direction = "Neutro";
      if (delta > 5) direction = "→ Governo";
      else if (delta < -5) direction = "→ Oposição";

      trends.push({
        nome: curr.deputado_nome,
        partido: curr.deputado_partido || "",
        prev: Number(prev.score),
        curr: Number(curr.score),
        delta: Math.round(delta * 100) / 100,
        direction,
      });
    }

    return trends.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 20);
  }, [byYear]);

  // Migration counts
  const migrations = useMemo(() => {
    const availableYears = ANOS.filter((y) => (byYear[y] || []).length > 0);
    if (availableYears.length < 2) return [];

    const results: { period: string; toGov: number; toOp: number; toCentro: number }[] = [];

    for (let i = 1; i < availableYears.length; i++) {
      const prevY = availableYears[i - 1];
      const currY = availableYears[i];
      const prevMap: Record<number, string> = {};
      for (const a of byYear[prevY] || []) prevMap[a.deputado_id] = a.classificacao;

      let toGov = 0, toOp = 0, toCentro = 0;
      for (const a of byYear[currY] || []) {
        const prev = prevMap[a.deputado_id];
        if (!prev || prev === a.classificacao) continue;
        if (a.classificacao === "Governo") toGov++;
        else if (a.classificacao === "Oposição") toOp++;
        else if (a.classificacao === "Centro") toCentro++;
      }
      results.push({ period: `${prevY}→${currY}`, toGov, toOp, toCentro });
    }
    return results;
  }, [byYear]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (allData.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Nenhum dado disponível para análise de tendências.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score médio por ano */}
      <Card className="p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Score Médio de Governismo por Ano
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={avgScoreData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="ano" className="text-xs" />
            <YAxis domain={[0, 100]} className="text-xs" />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Distribuição por classificação */}
      <Card className="p-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Distribuição da Base por Ano
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={classDistData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="ano" className="text-xs" />
            <YAxis className="text-xs" />
            <Tooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
            />
            <Legend />
            <Bar dataKey="Governo" fill="hsl(var(--governo))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Centro" fill="hsl(var(--centro))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Oposição" fill="hsl(var(--oposicao))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Migrações entre classificações */}
      {migrations.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
            <ArrowRightLeft size={14} />
            Movimentação da Base
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {migrations.map((m) => (
              <Card key={m.period} className="p-3 border">
                <div className="text-xs font-bold text-foreground mb-2">{m.period}</div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-governo font-bold">→ Governo</span>
                    <span className="font-black text-governo">{m.toGov}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-centro font-bold">→ Centro</span>
                    <span className="font-black text-centro">{m.toCentro}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-oposicao font-bold">→ Oposição</span>
                    <span className="font-black text-oposicao">{m.toOp}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      )}

      {/* Tendências do Centro */}
      {centroTrends.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Tendências do Centro – Para Onde Estão Indo?
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
            {centroTrends.map((t, i) => (
              <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-muted/50">
                {t.direction === "→ Governo" ? (
                  <TrendingUp size={16} className="text-governo shrink-0" />
                ) : t.direction === "→ Oposição" ? (
                  <TrendingDown size={16} className="text-oposicao shrink-0" />
                ) : (
                  <Minus size={16} className="text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-foreground truncate block">{t.nome}</span>
                  <span className="text-[10px] text-muted-foreground">{t.partido}</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    {t.prev.toFixed(1)}% → {t.curr.toFixed(1)}%
                  </span>
                  <div className={`font-black text-[10px] ${
                    t.delta > 0 ? "text-governo" : t.delta < 0 ? "text-oposicao" : "text-muted-foreground"
                  }`}>
                    {t.delta > 0 ? "+" : ""}{t.delta}% {t.direction}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
