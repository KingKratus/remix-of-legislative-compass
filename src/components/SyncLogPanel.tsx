import { Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useSyncLogs } from "@/hooks/useSyncLogs";

const statusIcon: Record<string, React.ReactNode> = {
  running: <Loader2 size={14} className="animate-spin text-primary" />,
  done: <CheckCircle2 size={14} className="text-governo" />,
  error: <XCircle size={14} className="text-oposicao" />,
};

export function SyncLogPanel() {
  const { logs, loading } = useSyncLogs();

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Carregando logs...</span>
        </div>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-xs text-muted-foreground text-center">Nenhuma sincronização registrada</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
        <Clock size={12} />
        Últimas Sincronizações
      </h3>
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
        {logs.slice(0, 10).map((log) => (
          <div key={log.id} className="flex items-start gap-2 text-xs">
            {statusIcon[log.status] || statusIcon.running}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{log.ano}</span>
                <span className="text-[9px] text-muted-foreground">
                  {new Date(log.started_at).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">
                {log.deputados_atualizados} deputados • {log.votacoes_processadas} votações
                {log.message && ` • ${log.message}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
