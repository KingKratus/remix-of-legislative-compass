import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function normalizeVoto(voto: string | null | undefined): string {
  if (!voto) return "";
  const v = voto.trim().toLowerCase();
  if (v === "sim" || v === "yes") return "Sim";
  if (v === "não" || v === "nao" || v === "no") return "Não";
  if (v.includes("abstenção") || v.includes("abstencao")) return "Abstenção";
  if (v.includes("obstrução") || v.includes("obstrucao")) return "Obstrução";
  if (v.includes("ausente") || v.includes("ausência")) return "Ausente";
  return voto.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const deputadoId: number = body.deputado_id;
    const year: number = body.ano || 2025;
    const limit: number = body.limit || 60;

    if (!deputadoId) {
      return new Response(
        JSON.stringify({ error: "deputado_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching votes for deputy ${deputadoId}, year ${year}, limit ${limit}`);

    // Get votação IDs with gov orientation from our DB
    const { data: orientacoes } = await supabase
      .from("orientacoes")
      .select("id_votacao, orientacao_voto, sigla_orgao_politico")
      .in("sigla_orgao_politico", ["Governo", "Gov.", "Líder do Governo", "LIDGOV", "governo", "gov."]);

    if (!orientacoes || orientacoes.length === 0) {
      return new Response(
        JSON.stringify({ votes: [], message: "No government orientations found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get votação metadata from our DB
    const { data: votacoes } = await supabase
      .from("votacoes")
      .select("id_votacao, data, descricao, sigla_orgao")
      .eq("ano", year)
      .order("data", { ascending: false });

    const votacaoMap: Record<string, { data: string | null; descricao: string | null; sigla_orgao: string | null }> = {};
    for (const v of votacoes || []) {
      votacaoMap[v.id_votacao] = { data: v.data, descricao: v.descricao, sigla_orgao: v.sigla_orgao };
    }

    // Build gov orientation map
    const govOrientMap: Record<string, string> = {};
    for (const o of orientacoes) {
      govOrientMap[o.id_votacao] = o.orientacao_voto;
    }

    // Filter to votações that are in our year and have gov orientation
    const relevantIds = Object.keys(govOrientMap).filter((id) => votacaoMap[id]);
    const idsToFetch = relevantIds.slice(0, limit);

    console.log(`Fetching deputy votes for ${idsToFetch.length} votações`);

    const votes: Array<{
      id_votacao: string;
      data: string | null;
      descricao: string | null;
      sigla_orgao: string | null;
      voto_deputado: string;
      orientacao_governo: string;
      alinhado: boolean;
    }> = [];

    for (const votacaoId of idsToFetch) {
      try {
        const res = await fetch(`${API_BASE}/votacoes/${votacaoId}/votos`);
        if (res.status === 429) {
          await sleep(2000);
          const retry = await fetch(`${API_BASE}/votacoes/${votacaoId}/votos`);
          if (!retry.ok) continue;
          const json = await retry.json();
          extractDeputyVote(json.dados || [], deputadoId, votacaoId, govOrientMap, votacaoMap, votes);
        } else if (res.ok) {
          const json = await res.json();
          extractDeputyVote(json.dados || [], deputadoId, votacaoId, govOrientMap, votacaoMap, votes);
        }
        await sleep(250);
      } catch (err) {
        console.error(`Error fetching ${votacaoId}: ${err.message}`);
      }
    }

    // Sort by date descending
    votes.sort((a, b) => {
      if (!a.data && !b.data) return 0;
      if (!a.data) return 1;
      if (!b.data) return -1;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });

    return new Response(
      JSON.stringify({ votes, total: votes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractDeputyVote(
  votos: any[],
  deputadoId: number,
  votacaoId: string,
  govOrientMap: Record<string, string>,
  votacaoMap: Record<string, any>,
  results: any[]
) {
  const depVoto = votos.find((v: any) => v.deputado_?.id === deputadoId);
  if (!depVoto) return;

  const votoNorm = normalizeVoto(depVoto.tipoVoto);
  const govOrient = normalizeVoto(govOrientMap[votacaoId]);
  const meta = votacaoMap[votacaoId] || {};

  const isRelevant = !["Abstenção", "Ausente", "Obstrução", ""].includes(votoNorm);
  const alinhado = isRelevant && votoNorm === govOrient;

  results.push({
    id_votacao: votacaoId,
    data: meta.data || null,
    descricao: meta.descricao || null,
    sigla_orgao: meta.sigla_orgao || null,
    voto_deputado: votoNorm || "Ausente",
    orientacao_governo: govOrient || "N/A",
    alinhado,
  });
}
