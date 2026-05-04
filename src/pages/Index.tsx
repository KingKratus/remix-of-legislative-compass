import { useState, useMemo } from "react";
import {
  Users,
  Search,
  AlertTriangle,
  Download,
  BarChart2,
  Trophy,
  TrendingUp,
  Map as MapIcon,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { StatsPanel } from "@/components/StatsPanel";
import { DeputyCard } from "@/components/DeputyCard";
import { RankingTable } from "@/components/RankingTable";
import { PartyChart } from "@/components/PartyChart";
import { InsightsPanel } from "@/components/InsightsPanel";
import { BrazilMap } from "@/components/BrazilMap";
import { SyncLogPanel } from "@/components/SyncLogPanel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeputados, type Deputado } from "@/hooks/useDeputados";
import { useAnalises } from "@/hooks/useAnalises";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { exportAnalisesCsv } from "@/lib/exportCsv";
import { getRegiao } from "@/lib/regioesUf";

const Index = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [partyFilter, setPartyFilter] = useState("all");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [classFilter, setClassFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");

  const { deputados, partidos, loading: depLoading } = useDeputados();
  const {
    analises,
    loading: analLoading,
    syncing,
    syncProgress,
    error,
    syncDeputados,
    refetch,
  } = useAnalises(ano);
  const { user, signInWithGoogle, signOut } = useAuth();
  const { isFavorite, toggleFavorite } = useProfile(user?.id);

  const analiseMap = useMemo(() => {
    const map: Record<number, (typeof analises)[0]> = {};
    analises.forEach((a) => { map[a.deputado_id] = a; });
    return map;
  }, [analises]);

  // Merge active deputies (API) with historical ones from analises for the selected year
  const allDeputies = useMemo(() => {
    const byId = new Map<number, Deputado>();
    deputados.forEach((d) => byId.set(d.id, d));
    analises.forEach((a) => {
      if (!byId.has(a.deputado_id)) {
        byId.set(a.deputado_id, {
          id: a.deputado_id,
          nome: a.deputado_nome,
          siglaPartido: a.deputado_partido ?? "",
          siglaUf: a.deputado_uf ?? "",
          urlFoto: a.deputado_foto ?? "",
        });
      }
    });
    return Array.from(byId.values());
  }, [deputados, analises]);

  // Build party list dynamically from analises of selected year (+ active list for current year)
  const partidosDisponiveis = useMemo(() => {
    const siglas = new Set<string>();
    analises.forEach((a) => { if (a.deputado_partido) siglas.add(a.deputado_partido); });
    const isCurrentYear = ano === new Date().getFullYear();
    if (isCurrentYear || siglas.size === 0) {
      partidos.forEach((p) => siglas.add(p.sigla));
    }
    return Array.from(siglas)
      .sort((a, b) => a.localeCompare(b))
      .map((sigla, idx) => ({ id: idx, sigla, nome: sigla }));
  }, [analises, partidos, ano]);

  const filteredDeputies = useMemo(() => {
    return allDeputies.filter((d) => {
      const a = analiseMap[d.id];
      const partidoAtual = a?.deputado_partido ?? d.siglaPartido;
      const ufAtual = a?.deputado_uf ?? d.siglaUf;
      const matchName = d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (a?.deputado_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchParty = partyFilter === "all" || partidoAtual === partyFilter;
      const matchClass = classFilter === "all" || a?.classificacao === classFilter;
      const matchRegion = regionFilter === "all" || getRegiao(ufAtual) === regionFilter;
      return matchName && matchParty && matchClass && matchRegion;
    });
  }, [allDeputies, searchTerm, partyFilter, classFilter, regionFilter, analiseMap]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        partyFilter={partyFilter}
        onPartyFilterChange={setPartyFilter}
        ano={ano}
        onAnoChange={setAno}
        classFilter={classFilter}
        onClassFilterChange={setClassFilter}
        regionFilter={regionFilter}
        onRegionFilterChange={setRegionFilter}
        partidos={partidosDisponiveis}
        loading={depLoading || analLoading}
        onRefresh={refetch}
        user={user}
        onSignIn={signInWithGoogle}
        onSignOut={signOut}
      />

      <main className="max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 xl:grid-cols-12 gap-6">
        <aside className="xl:col-span-3 space-y-4">
          <StatsPanel
            analises={analises}
            totalDeputados={deputados.length}
            syncing={syncing}
            syncProgress={syncProgress}
            onSync={() => syncDeputados(30)}
          />
          <SyncLogPanel />
          {user && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                const ids = new Set(filteredDeputies.map((d) => d.id));
                const filteredAnalises = analises.filter((a) => ids.has(a.deputado_id));
                exportAnalisesCsv(filteredAnalises, ano, {
                  partido: partyFilter,
                  classificacao: classFilter,
                  regiao: regionFilter,
                });
              }}
              disabled={filteredDeputies.length === 0}
              title="Exporta os deputados visíveis com os filtros atuais"
            >
              <Download size={14} className="mr-2" />
              Exportar CSV ({filteredDeputies.length})
            </Button>
          )}
        </aside>

        <section className="xl:col-span-9 space-y-4">
          <Tabs defaultValue="deputados">
            <TabsList>
              <TabsTrigger value="deputados" className="gap-2">
                <Users size={14} /> Deputados
              </TabsTrigger>
              <TabsTrigger value="ranking" className="gap-2">
                <Trophy size={14} /> Ranking
              </TabsTrigger>
              <TabsTrigger value="partidos" className="gap-2">
                <BarChart2 size={14} /> Partidos
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2">
                <TrendingUp size={14} /> Insights
              </TabsTrigger>
              <TabsTrigger value="mapa" className="gap-2">
                <MapIcon size={14} /> Mapa
              </TabsTrigger>
            </TabsList>

            <TabsContent value="deputados" className="space-y-4 mt-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3">
                  <AlertTriangle size={20} className="text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error}</p>
                </div>
              )}

              <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  {filteredDeputies.length} deputados
                </h2>
                <span className="text-[9px] font-bold text-muted-foreground bg-muted px-3 py-1 rounded-full uppercase tracking-widest">
                  {ano}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-10 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredDeputies.map((dep) => (
                  <DeputyCard
                    key={dep.id}
                    deputado={dep}
                    analise={analiseMap[dep.id]}
                    isFavorite={user ? isFavorite(dep.id) : undefined}
                    onToggleFavorite={user ? toggleFavorite : undefined}
                  />
                ))}
              </div>

              {!depLoading && filteredDeputies.length === 0 && (
                <div className="py-16 text-center bg-card rounded-2xl border-2 border-dashed border-border">
                  <Search size={40} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground font-semibold text-sm">
                    Nenhum deputado encontrado
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="ranking" className="mt-4">
              <RankingTable analises={analises} />
            </TabsContent>

            <TabsContent value="partidos" className="mt-4">
              <PartyChart analises={analises} />
            </TabsContent>

            <TabsContent value="insights" className="mt-4">
              <InsightsPanel />
            </TabsContent>

            <TabsContent value="mapa" className="mt-4">
              <BrazilMap analises={analises} />
            </TabsContent>
          </Tabs>
        </section>
      </main>

      <footer className="text-center py-8">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em]">
          Monitor Legislativo • Transparência • {ano}
        </p>
      </footer>
    </div>
  );
};

export default Index;
