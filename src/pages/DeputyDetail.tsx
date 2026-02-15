import { useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useDeputyVotes } from "@/hooks/useDeputyVotes";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

const classColors: Record<string, string> = {
  Governo: "bg-governo text-governo-foreground",
  Centro: "bg-centro text-centro-foreground",
  Oposição: "bg-oposicao text-oposicao-foreground",
  "Sem Dados": "bg-muted text-muted-foreground",
};

export default function DeputyDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deputadoId = Number(id) || 0;
  const ano = Number(searchParams.get("ano")) || 2025;

  const [analise, setAnalise] = useState<Analise | null>(null);
  const [loadingAnalise, setLoadingAnalise] = useState(true);

  const { votes, loading: loadingVotes, error, fetchVotes } = useDeputyVotes(deputadoId, ano);

  useEffect(() => {
    async function load() {
      if (!deputadoId) return;
      setLoadingAnalise(true);
      const { data } = await supabase
        .from("analises_deputados")
        .select("*")
        .eq("deputado_id", deputadoId)
        .eq("ano", ano)
        .maybeSingle();
      setAnalise(data);
      setLoadingAnalise(false);
    }
    load();
    fetchVotes();
  }, [deputadoId, ano, fetchVotes]);

  const stats = useMemo(() => {
    const aligned = votes.filter((v) => v.alinhado).length;
    const opposed = votes.filter((v) => !v.alinhado && !["Ausente", "Abstenção", "Obstrução"].includes(v.voto_deputado)).length;
    const other = votes.length - aligned - opposed;
    return { aligned, opposed, other, total: votes.length };
  }, [votes]);

  if (loadingAnalise) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>

          {analise && (
            <div className="flex items-center gap-4 flex-1">
              <img
                src={analise.deputado_foto || ""}
                alt={analise.deputado_nome}
                className="w-14 h-14 rounded-xl object-cover border-2 border-border shadow-sm"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    "https://www.camara.leg.br/tema/assets/images/foto-deputado-ausente.png";
                }}
              />
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold truncate">{analise.deputado_nome}</h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                    {analise.deputado_partido}
                  </span>
                  <span className="text-xs text-muted-foreground">{analise.deputado_uf}</span>
                  <Badge className={`text-[10px] ${classColors[analise.classificacao]}`}>
                    {analise.classificacao}
                  </Badge>
                </div>
              </div>

              <div className="text-right shrink-0">
                <div className="text-2xl font-black text-foreground">
                  {Number(analise.score).toFixed(1)}%
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Índice de Governismo
                </span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Stats summary */}
        {analise && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Alinhamento {ano}
              </span>
              <span className="text-xs text-muted-foreground">
                {analise.total_votos} votos úteis
              </span>
            </div>
            <Progress value={Number(analise.score)} className="h-3 mb-3" />
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-governo/10 rounded-lg p-2">
                <div className="text-lg font-black text-governo">{stats.aligned}</div>
                <div className="text-[10px] font-bold text-governo uppercase">Alinhados</div>
              </div>
              <div className="bg-oposicao/10 rounded-lg p-2">
                <div className="text-lg font-black text-oposicao">{stats.opposed}</div>
                <div className="text-[10px] font-bold text-oposicao uppercase">Contrários</div>
              </div>
              <div className="bg-muted rounded-lg p-2">
                <div className="text-lg font-black text-muted-foreground">{stats.other}</div>
                <div className="text-[10px] font-bold text-muted-foreground uppercase">Outros</div>
              </div>
            </div>
          </Card>
        )}

        {/* Vote History */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Histórico de Votações
          </h2>
          {loadingVotes && <Loader2 className="animate-spin text-primary" size={16} />}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle size={18} className="text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loadingVotes && votes.length === 0 && !error && (
          <Card className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhum voto encontrado para {ano}.</p>
          </Card>
        )}

        <div className="space-y-2 pb-10">
          {votes.map((vote) => (
            <Card key={vote.id_votacao} className="p-3 border">
              <div className="flex items-start gap-3">
                {vote.alinhado ? (
                  <CheckCircle2 size={18} className="text-governo shrink-0 mt-0.5" />
                ) : ["Ausente", "Abstenção", "Obstrução"].includes(vote.voto_deputado) ? (
                  <MinusCircle size={18} className="text-muted-foreground shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={18} className="text-oposicao shrink-0 mt-0.5" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium leading-snug line-clamp-2">
                    {vote.descricao || vote.id_votacao}
                  </p>
                  {vote.data && (
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(vote.data).toLocaleDateString("pt-BR")}
                      {vote.sigla_orgao && ` • ${vote.sigla_orgao}`}
                    </span>
                  )}
                </div>

                <div className="flex gap-2 shrink-0">
                  <div className="text-center">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Deputado</div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        vote.voto_deputado === "Sim"
                          ? "border-governo text-governo"
                          : vote.voto_deputado === "Não"
                          ? "border-oposicao text-oposicao"
                          : "border-muted-foreground text-muted-foreground"
                      }`}
                    >
                      {vote.voto_deputado}
                    </Badge>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] font-bold text-muted-foreground uppercase">Governo</div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        vote.orientacao_governo === "Sim"
                          ? "border-governo text-governo"
                          : vote.orientacao_governo === "Não"
                          ? "border-oposicao text-oposicao"
                          : "border-muted-foreground text-muted-foreground"
                      }`}
                    >
                      {vote.orientacao_governo}
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
