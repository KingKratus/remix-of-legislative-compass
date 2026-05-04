import { useMemo, useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

// More accurate simplified SVG paths for Brazilian states.
// ViewBox: 0 0 1000 1000. Coords approximated to reflect Brazil's actual outline.
const STATES: Record<string, { path: string; cx: number; cy: number; nome: string }> = {
  // Norte
  RR: {
    nome: "Roraima",
    path: "M385,90 L470,80 L520,150 L500,230 L420,240 L370,200 L355,150 Z",
    cx: 430, cy: 160,
  },
  AP: {
    nome: "Amapá",
    path: "M620,150 L690,140 L720,200 L700,260 L640,265 L610,220 Z",
    cx: 660, cy: 205,
  },
  AM: {
    nome: "Amazonas",
    path: "M120,200 L355,150 L370,200 L420,240 L500,230 L520,310 L500,400 L420,420 L300,430 L200,415 L130,380 L100,300 Z",
    cx: 290, cy: 310,
  },
  PA: {
    nome: "Pará",
    path: "M520,150 L610,220 L640,265 L700,260 L710,330 L690,420 L630,470 L540,470 L490,430 L500,400 L520,310 Z",
    cx: 600, cy: 340,
  },
  AC: {
    nome: "Acre",
    path: "M100,420 L200,415 L220,470 L150,490 L90,470 Z",
    cx: 150, cy: 450,
  },
  RO: {
    nome: "Rondônia",
    path: "M220,470 L300,430 L370,470 L360,540 L260,560 L210,510 Z",
    cx: 290, cy: 500,
  },
  TO: {
    nome: "Tocantins",
    path: "M540,470 L630,470 L640,560 L620,640 L570,660 L530,610 L520,540 Z",
    cx: 580, cy: 560,
  },
  // Nordeste
  MA: {
    nome: "Maranhão",
    path: "M630,470 L720,440 L780,470 L780,540 L720,580 L640,560 Z",
    cx: 710, cy: 510,
  },
  PI: {
    nome: "Piauí",
    path: "M720,440 L800,430 L830,510 L820,600 L780,610 L780,540 L780,470 Z",
    cx: 790, cy: 520,
  },
  CE: {
    nome: "Ceará",
    path: "M800,430 L880,400 L900,460 L880,520 L830,510 Z",
    cx: 855, cy: 460,
  },
  RN: {
    nome: "Rio G. do Norte",
    path: "M880,400 L950,400 L955,440 L900,460 Z",
    cx: 920, cy: 425,
  },
  PB: {
    nome: "Paraíba",
    path: "M900,460 L955,440 L955,485 L905,495 Z",
    cx: 930, cy: 470,
  },
  PE: {
    nome: "Pernambuco",
    path: "M830,510 L880,520 L905,495 L955,485 L950,525 L860,545 Z",
    cx: 895, cy: 520,
  },
  AL: {
    nome: "Alagoas",
    path: "M880,545 L940,535 L935,565 L880,570 Z",
    cx: 905, cy: 552,
  },
  SE: {
    nome: "Sergipe",
    path: "M860,565 L905,565 L900,595 L865,595 Z",
    cx: 880, cy: 580,
  },
  BA: {
    nome: "Bahia",
    path: "M640,560 L720,580 L780,610 L820,600 L860,545 L880,570 L900,595 L880,680 L820,720 L740,720 L680,700 L640,640 L620,640 Z",
    cx: 760, cy: 645,
  },
  // Centro-Oeste
  MT: {
    nome: "Mato Grosso",
    path: "M360,540 L490,430 L540,470 L520,540 L530,610 L510,690 L420,710 L340,680 L320,610 Z",
    cx: 430, cy: 590,
  },
  GO: {
    nome: "Goiás",
    path: "M510,690 L570,660 L620,640 L640,640 L680,700 L660,750 L600,780 L550,775 L510,750 Z",
    cx: 590, cy: 720,
  },
  DF: {
    nome: "Distrito Federal",
    path: "M615,705 L640,705 L640,725 L615,725 Z",
    cx: 627, cy: 715,
  },
  MS: {
    nome: "Mato G. do Sul",
    path: "M340,680 L420,710 L510,690 L510,750 L490,820 L420,840 L360,820 L340,760 Z",
    cx: 420, cy: 770,
  },
  // Sudeste
  MG: {
    nome: "Minas Gerais",
    path: "M510,750 L550,775 L600,780 L660,750 L740,720 L780,750 L770,810 L700,830 L620,830 L550,820 L510,790 Z",
    cx: 640, cy: 790,
  },
  ES: {
    nome: "Espírito Santo",
    path: "M770,810 L820,790 L835,840 L800,860 L770,840 Z",
    cx: 800, cy: 825,
  },
  RJ: {
    nome: "Rio de Janeiro",
    path: "M700,830 L770,840 L800,860 L770,880 L700,870 L680,850 Z",
    cx: 740, cy: 855,
  },
  SP: {
    nome: "São Paulo",
    path: "M490,820 L550,820 L620,830 L680,850 L660,890 L580,910 L500,890 L470,850 Z",
    cx: 575, cy: 860,
  },
  // Sul
  PR: {
    nome: "Paraná",
    path: "M420,840 L490,820 L500,890 L580,910 L560,940 L470,945 L400,920 L390,880 Z",
    cx: 480, cy: 895,
  },
  SC: {
    nome: "Santa Catarina",
    path: "M400,920 L470,945 L560,940 L545,970 L470,975 L400,950 Z",
    cx: 480, cy: 950,
  },
  RS: {
    nome: "Rio G. do Sul",
    path: "M380,940 L470,975 L545,970 L520,1000 L420,1010 L350,990 Z",
    cx: 450, cy: 985,
  },
};

function scoreToColor(score: number | null): string {
  if (score === null) return "hsl(var(--muted))";
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
    const map: Record<string, { sum: number; count: number }> = {};
    analises.forEach((a) => {
      const uf = a.deputado_uf;
      if (!uf) return;
      if (!map[uf]) map[uf] = { sum: 0, count: 0 };
      map[uf].sum += Number(a.score);
      map[uf].count++;
    });
    const result: Record<string, { avg: number; count: number }> = {};
    Object.entries(map).forEach(([uf, d]) => {
      result[uf] = { avg: d.count > 0 ? d.sum / d.count : 0, count: d.count };
    });
    return result;
  }, [analises]);

  const hoveredData = hovered ? ufData[hovered] : null;
  const hoveredMeta = hovered ? STATES[hovered] : null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
        Mapa de Governismo por Estado
      </h3>

      <div className="flex flex-col lg:flex-row items-start gap-4">
        <div className="relative flex-1 w-full">
          <svg
            viewBox="50 50 920 980"
            className="w-full h-auto max-h-[600px]"
            xmlns="http://www.w3.org/2000/svg"
          >
            {Object.entries(STATES).map(([uf, { path }]) => {
              const data = ufData[uf];
              const color = scoreToColor(data ? data.avg : null);
              return (
                <path
                  key={uf}
                  d={path}
                  fill={color}
                  stroke="hsl(var(--background))"
                  strokeWidth={hovered === uf ? 3 : 1.5}
                  opacity={hovered && hovered !== uf ? 0.45 : 1}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHovered(uf)}
                  onMouseLeave={() => setHovered(null)}
                />
              );
            })}
            {Object.entries(STATES).map(([uf, { cx, cy }]) => (
              <text
                key={`label-${uf}`}
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none"
                fill="hsl(var(--foreground))"
                fontSize="20"
                fontWeight="900"
                style={{
                  paintOrder: "stroke",
                  stroke: "hsl(var(--background))",
                  strokeWidth: 3,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
              >
                {uf}
              </text>
            ))}
          </svg>
        </div>

        <div className="lg:w-52 space-y-3 w-full">
          {hovered && hoveredMeta ? (
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-bold text-foreground text-lg">{hovered}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {hoveredMeta.nome}
              </p>
              {hoveredData ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Score médio:{" "}
                    <span className="font-bold text-foreground">
                      {hoveredData.avg.toFixed(1)}%
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Deputados:{" "}
                    <span className="font-bold text-foreground">{hoveredData.count}</span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sem dados</p>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Passe o mouse sobre um estado para ver detalhes
            </p>
          )}

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              Legenda
            </p>
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
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ background: "hsl(var(--muted))", border: "1px solid hsl(var(--border))" }}
              />
              <span className="text-xs text-muted-foreground">Sem dados</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
