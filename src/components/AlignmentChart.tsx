import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { DeputyVote } from "@/hooks/useDeputyVotes";

interface AlignmentChartProps {
  votes: DeputyVote[];
}

export function AlignmentChart({ votes }: AlignmentChartProps) {
  const chartData = useMemo(() => {
    if (!votes.length) return [];

    // Sort ascending by date
    const sorted = [...votes]
      .filter((v) => v.data)
      .sort((a, b) => new Date(a.data!).getTime() - new Date(b.data!).getTime());

    let aligned = 0;
    let total = 0;

    return sorted.map((v) => {
      const isRelevant = !["Ausente", "Abstenção", "Obstrução"].includes(v.voto_deputado);
      if (isRelevant) {
        total++;
        if (v.alinhado) aligned++;
      }

      return {
        date: new Date(v.data!).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        score: total > 0 ? Math.round((aligned / total) * 100) : 0,
        total,
      };
    });
  }, [votes]);

  if (chartData.length < 2) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
        Evolução do Alinhamento
      </h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9 }}
              className="fill-muted-foreground"
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 9 }}
              className="fill-muted-foreground"
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                    <p className="font-bold text-foreground">{d.score}%</p>
                    <p className="text-muted-foreground">{d.date} • {d.total} votos</p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={70} stroke="hsl(var(--governo))" strokeDasharray="4 4" strokeOpacity={0.5} />
            <ReferenceLine y={35} stroke="hsl(var(--oposicao))" strokeDasharray="4 4" strokeOpacity={0.5} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, className: "fill-primary" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-governo inline-block" /> Governo (≥70%)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-oposicao inline-block" /> Oposição (≤35%)
        </span>
      </div>
    </Card>
  );
}
