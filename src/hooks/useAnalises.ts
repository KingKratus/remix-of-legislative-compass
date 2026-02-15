import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

export interface SyncProgress {
  processed: number;
  total: number;
  percent: number;
  done: boolean;
}

export function useAnalises(ano: number) {
  const [analises, setAnalises] = useState<Analise[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalises = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("analises_deputados")
      .select("*")
      .eq("ano", ano)
      .order("score", { ascending: false });

    if (err) {
      setError("Erro ao carregar análises do banco.");
    } else {
      setAnalises(data || []);
    }
    setLoading(false);
  }, [ano]);

  useEffect(() => {
    fetchAnalises();
  }, [fetchAnalises]);

  const syncDeputados = useCallback(
    async (batchSize = 30) => {
      setSyncing(true);
      setError(null);
      setSyncProgress({ processed: 0, total: 0, percent: 0, done: false });

      try {
        let batchStart = 0;
        let done = false;

        while (!done) {
          const { data, error: err } = await supabase.functions.invoke(
            "sync-camara",
            { body: { ano, batch_start: batchStart, batch_size: batchSize } }
          );

          if (err) throw err;
          if (data?.error) throw new Error(data.error);

          const total = data.total || 0;
          const processed = data.processed || 0;
          done = data.done === true;

          setSyncProgress({
            processed,
            total,
            percent: total > 0 ? Math.round((processed / total) * 100) : 0,
            done,
          });

          if (!done && data.next_batch_start != null) {
            batchStart = data.next_batch_start;
          } else {
            done = true;
          }

          // Refresh data after each batch so UI updates progressively
          await fetchAnalises();
        }

        return { success: true };
      } catch (e: any) {
        setError(e.message || "Erro ao sincronizar com a API da Câmara.");
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [ano, fetchAnalises]
  );

  return { analises, loading, syncing, syncProgress, error, syncDeputados, refetch: fetchAnalises };
}
