import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Analise = Tables<"analises_deputados">;

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, toggleFavorite } = useProfile(user?.id);
  const [favoriteAnalises, setFavoriteAnalises] = useState<Analise[]>([]);
  const [loadingFavs, setLoadingFavs] = useState(false);

  useEffect(() => {
    if (!user && !authLoading) navigate("/");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function loadFavorites() {
      const favs = profile?.favoritos;
      if (!favs || favs.length === 0) {
        setFavoriteAnalises([]);
        return;
      }
      setLoadingFavs(true);
      // Fetch ALL years for favorites — full snapshot history
      const { data } = await supabase
        .from("analises_deputados")
        .select("*")
        .in("deputado_id", favs)
        .order("ano", { ascending: false })
        .order("score", { ascending: false });
      setFavoriteAnalises(data || []);
      setLoadingFavs(false);
    }
    loadFavorites();
  }, [profile?.favoritos]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  const classTextColors: Record<string, string> = {
    Governo: "text-governo",
    Centro: "text-centro",
    Oposição: "text-oposicao",
    "Sem Dados": "text-muted-foreground",
  };

  // Group by year
  const byYear = favoriteAnalises.reduce<Record<number, Analise[]>>((acc, a) => {
    (acc[a.ano] ||= []).push(a);
    return acc;
  }, {});
  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  const favoritesCount = profile?.favoritos?.length || 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft size={20} />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            {user?.user_metadata?.avatar_url && (
              <img
                src={user.user_metadata.avatar_url}
                alt="Avatar"
                className="w-12 h-12 rounded-xl border-2 border-border"
              />
            )}
            <div>
              <h1 className="text-lg font-bold">
                {profile?.display_name || user?.user_metadata?.full_name || "Perfil"}
              </h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-1">
            <Star size={14} className="text-primary" />
            Deputados Favoritos ({favoritesCount})
          </h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-4">
            <History size={12} /> Histórico por ano — partido e UF de cada ano
          </p>

          {loadingFavs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : favoritesCount === 0 ? (
            <Card className="p-8 text-center border-2 border-dashed">
              <Star size={32} className="mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">
                Nenhum favorito ainda. Clique na estrela nos cards de deputados para favoritar.
              </p>
            </Card>
          ) : favoriteAnalises.length === 0 ? (
            <Card className="p-8 text-center border-2 border-dashed">
              <p className="text-sm text-muted-foreground">
                Sem dados de análise ainda para seus favoritos. Execute a sincronização.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {years.map((year) => (
                <div key={year}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-black text-foreground bg-primary/10 text-primary px-3 py-1 rounded-full uppercase tracking-widest">
                      {year}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {byYear[year].length} deputado{byYear[year].length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {byYear[year].map((a) => (
                      <Card
                        key={a.id}
                        className="p-4 cursor-pointer hover:shadow-lg transition-all"
                        onClick={() => navigate(`/deputado/${a.deputado_id}?ano=${a.ano}`)}
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={a.deputado_foto || ""}
                            alt={a.deputado_nome}
                            className="w-10 h-10 rounded-lg object-cover border border-border"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://www.camara.leg.br/tema/assets/images/foto-deputado-ausente.png";
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold truncate">{a.deputado_nome}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                                {a.deputado_partido || "—"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {a.deputado_uf || "—"}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-lg font-black">
                              {Number(a.score).toFixed(1)}%
                            </div>
                            <span
                              className={`text-[9px] font-bold uppercase ${classTextColors[a.classificacao]}`}
                            >
                              {a.classificacao}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(a.deputado_id);
                            }}
                            title="Remover dos favoritos"
                          >
                            <Star size={16} className="fill-primary text-primary" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
