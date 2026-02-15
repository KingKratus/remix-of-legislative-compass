import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DeputyVote {
  id_votacao: string;
  data: string | null;
  descricao: string | null;
  sigla_orgao: string | null;
  voto_deputado: string;
  orientacao_governo: string;
  alinhado: boolean;
}

export function useDeputyVotes(deputadoId: number, ano: number) {
  const [votes, setVotes] = useState<DeputyVote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVotes = useCallback(async () => {
    if (!deputadoId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("deputy-votes", {
        body: { deputado_id: deputadoId, ano, limit: 60 },
      });
      if (err) throw err;
      if (data?.error) throw new Error(data.error);
      setVotes(data?.votes || []);
    } catch (e: any) {
      setError(e.message || "Erro ao carregar histórico de votos.");
    } finally {
      setLoading(false);
    }
  }, [deputadoId, ano]);

  return { votes, loading, error, fetchVotes };
}
