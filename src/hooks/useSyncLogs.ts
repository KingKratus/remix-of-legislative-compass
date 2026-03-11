import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SyncLog {
  id: string;
  ano: number;
  status: string;
  votacoes_processadas: number;
  deputados_atualizados: number;
  started_at: string;
  finished_at: string | null;
  message: string | null;
}

export function useSyncLogs() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("sync_logs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    setLogs((data as SyncLog[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}
