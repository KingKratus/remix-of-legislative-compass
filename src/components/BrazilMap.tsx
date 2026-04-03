import { useMemo, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

// Simplified SVG paths for Brazilian states (approximated shapes)
const STATES: Record<string, { path: string; labelX: number; labelY: number }> = {
  AC: { path: "M95,280 L120,275 L125,295 L100,300 Z", labelX: 110, labelY: 288 },
  AM: { path: "M110,220 L200,210 L210,250 L200,280 L150,285 L120,275 L105,260 Z", labelX: 160, labelY: 250 },
  AP: { path: "M280,190 L300,180 L310,195 L305,215 L285,215 Z", labelX: 295, labelY: 200 },
  PA: { path: "M210,210 L310,195 L305,215 L340,225 L330,260 L300,280 L260,280 L230,270 L200,280 L210,250 Z", labelX: 270, labelY: 245 },
  RO: { path: "M150,285 L200,280 L205,310 L180,325 L150,315 Z", labelX: 175, labelY: 305 },
  RR: { path: "M170,175 L200,165 L210,190 L200,210 L175,210 Z", labelX: 190, labelY: 190 },
  TO: { path: "M300,280 L320,275 L325,320 L310,345 L290,340 L285,310 Z", labelX: 305, labelY: 310 },
  AL: { path: "M400,330 L415,325 L418,335 L405,340 Z", labelX: 408, labelY: 333 },
  BA: { path: "M330,330 L380,310 L410,325 L405,340 L395,370 L370,395 L340,395 L325,370 Z", labelX: 365, labelY: 355 },
  CE: { path: "M380,260 L405,255 L410,275 L400,290 L380,285 Z", labelX: 395, labelY: 272 },
  MA: { path: "M300,250 L340,240 L350,260 L340,280 L315,275 Z", labelX: 325, labelY: 260 },
  PB: { path: "M400,300 L420,295 L422,308 L402,312 Z", labelX: 412, labelY: 303 },
  PE: { path: "M380,310 L420,308 L418,325 L400,330 L380,325 Z", labelX: 400, labelY: 318 },
  PI: { path: "M340,280 L370,270 L380,285 L380,310 L355,320 L330,330 L325,320 L320,295 Z", labelX: 350, labelY: 300 },
  RN: { path: "M400,285 L420,280 L422,295 L402,300 Z", labelX: 412, labelY: 290 },
  SE: { path: "M405,340 L418,335 L420,348 L408,352 Z", labelX: 412, labelY: 344 },
  DF: { path: "M305,370 L315,368 L317,378 L307,380 Z", labelX: 311, labelY: 374 },
  GO: { path: "M280,345 L325,340 L340,370 L330,400 L300,410 L280,390 Z", labelX: 310, labelY: 375 },
  MT: { path: "M200,310 L280,300 L285,340 L280,390 L240,400 L210,380 L200,340 Z", labelX: 240, labelY: 350 },
  MS: { path: "M230,400 L280,390 L285,420 L270,450 L240,450 L225,430 Z", labelX: 255, labelY: 425 },
  ES: { path: "M380,380 L400,375 L402,395 L385,400 Z", labelX: 390, labelY: 388 },
  MG: { path: "M310,370 L370,355 L380,380 L385,400 L365,420 L330,425 L305,415 L300,395 Z", labelX: 340, labelY: 395 },
  RJ: { path: "M365,420 L390,415 L395,430 L375,435 Z", labelX: 378, labelY: 425 },
  SP: { path: "M280,415 L330,410 L350,425 L345,450 L310,460 L280,450 Z", labelX: 315, labelY: 435 },
  PR: { path: "M265,455 L310,450 L320,470 L300,485 L265,480 Z", labelX: 290, labelY: 468 },
  RS: { path: "M255,500 L290,490 L300,510 L290,540 L260,545 L245,525 Z", labelX: 272, labelY: 520 },
  SC: { path: "M270,485 L305,480 L308,500 L275,505 Z", labelX: 288, labelY: 492 },
};

function scoreToColor(score: number | null): string {
  if (score === null) return "hsl(var(--muted))";
  // 0 = opposition (red), 50 = center (blue/purple), 100 = government (green)
  if (score >= 70) return "hsl(160, 84%, 39%)";
  if (score >= 55) return "hsl(160, 60%, 50%)";
  if (score >= 45) return "hsl(239, 60%, 60%)";
  if (score >= 30) return "hsl(347, 60%, 55%)";
  return "hsl(347, 77%, 50%)";
}

interface BrazilMapProps {
  analises: Analise[];
}

export function BrazilMap({ analises }: BrazilMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const ufData = useMemo(() => {
    const map: Record<string, { total: number; sum: number; count: number }> = {};
    analises.forEach((a) => {
      const uf = a.deputado_uf;
      if (!uf) return;
      if (!map[uf]) map[uf] = { total: 0, sum: 0, count: 0 };
      map[uf].total++;
      map[uf].sum += Number(a.score);
      map[uf].count++;
    });
    const result: Record<string, { avg: number; count: number }> = {};
    Object.entries(map).forEach(([uf, d]) => {
      result[uf] = { avg: d.count > 0 ? d.sum / d.count : 0, count: d.total };
    });
    return result;
  }, [analises]);

  const hoveredData = hovered ? ufData[hovered] : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
        Mapa de Governismo por Estado
      </h3>

      <div className="flex flex-col lg:flex-row items-start gap-4">
        <div className="relative flex-1 w-full">
          <svg
            viewBox="80 155 360 410"
            className="w-full h-auto max-h-[500px]"
            style={{ aspectRatio: "360/410" }}
          >
            {Object.entries(STATES).map(([uf, { path }]) => {
              const data = ufData[uf];
              const color = scoreToColor(data ? data.avg : null);
              return (
                <path
                  key={uf}
                  d={path}
                  fill={color}
                  stroke="hsl(var(--border))"
                  strokeWidth={hovered === uf ? 2 : 0.8}
                  opacity={hovered && hovered !== uf ? 0.5 : 1}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHovered(uf)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {Object.entries(STATES).map(([uf, { labelX, labelY }]) => (
              <text
                key={`label-${uf}`}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none"
                fill="hsl(var(--foreground))"
                fontSize="7"
                fontWeight="bold"
              >
                {uf}
              </text>
            ))}
          </svg>
        </div>

        <div className="lg:w-48 space-y-3">
          {hovered && hoveredData ? (
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-bold text-foreground text-lg">{hovered}</p>
              <p className="text-sm text-muted-foreground">
                Score médio: <span className="font-bold text-foreground">{hoveredData.avg.toFixed(1)}%</span>
              </p>
              <p className="text-sm text-muted-foreground">
                Deputados: <span className="font-bold text-foreground">{hoveredData.count}</span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Passe o mouse sobre um estado para ver detalhes</p>
          )}

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Legenda</p>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "hsl(160, 84%, 39%)" }} />
              <span className="text-xs text-muted-foreground">Governo (≥70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "hsl(160, 60%, 50%)" }} />
              <span className="text-xs text-muted-foreground">Pró-Governo (55-70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "hsl(239, 60%, 60%)" }} />
              <span className="text-xs text-muted-foreground">Centro (45-55%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "hsl(347, 60%, 55%)" }} />
              <span className="text-xs text-muted-foreground">Pró-Oposição (30-45%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "hsl(347, 77%, 50%)" }} />
              <span className="text-xs text-muted-foreground">Oposição (&lt;30%)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
