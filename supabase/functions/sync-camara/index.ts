import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return res;
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
      continue;
    }
    throw new Error(`API error: ${res.status}`);
  }
  throw new Error("Max retries exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { ano, deputado_id, limit = 30 } = await req.json();
    const year = ano || new Date().getFullYear();
    const dataInicio = `${year}-01-01`;
    const dataFim = `${year}-12-31`;

    // If a specific deputy is requested, analyze just that one
    if (deputado_id) {
      const result = await analyzeDeputy(
        supabase,
        deputado_id,
        dataInicio,
        dataFim,
        year,
        limit
      );
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Batch: fetch deputies list and analyze first N
    const depRes = await fetchWithRetry(
      `${API_BASE}/deputados?ordem=ASC&ordenarPor=nome&itens=600`
    );
    const depData = await depRes.json();
    const deputies = depData.dados || [];

    const results = [];
    for (const dep of deputies.slice(0, limit)) {
      try {
        const r = await analyzeDeputy(
          supabase,
          dep.id,
          dataInicio,
          dataFim,
          year,
          30,
          dep
        );
        results.push(r);
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        continue;
      }
    }

    return new Response(JSON.stringify({ analyzed: results.length, year }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function analyzeDeputy(
  supabase: any,
  depId: number,
  dataInicio: string,
  dataFim: string,
  year: number,
  itemsLimit: number,
  depInfo?: any
) {
  // Fetch deputy info if not provided
  if (!depInfo) {
    const infoRes = await fetchWithRetry(`${API_BASE}/deputados/${depId}`);
    const infoData = await infoRes.json();
    depInfo = infoData.dados || {};
    depInfo.nome = depInfo.nomeCivil || depInfo.ultimoStatus?.nome || "N/A";
    depInfo.siglaPartido = depInfo.ultimoStatus?.siglaPartido || "";
    depInfo.siglaUf = depInfo.ultimoStatus?.siglaUf || "";
    depInfo.urlFoto = depInfo.ultimoStatus?.urlFoto || "";
  }

  // Fetch votes for this deputy
  const votesRes = await fetchWithRetry(
    `${API_BASE}/deputados/${depId}/votacoes?dataInicio=${dataInicio}&dataFim=${dataFim}&ordem=DESC&itens=${itemsLimit}`
  );
  const votesData = await votesRes.json();
  const votes = votesData.dados || [];

  let aligned = 0;
  let relevantVotes = 0;

  for (const vote of votes) {
    const votacaoId = String(vote.idVotacao);

    // Cache votacao in DB
    await supabase.from("votacoes").upsert(
      {
        id_votacao: votacaoId,
        data: vote.dataHoraVoto || vote.data,
        descricao: vote.descricao || vote.proposicaoObjeto || null,
        ano: year,
        sigla_orgao: vote.siglaOrgao || null,
      },
      { onConflict: "id_votacao" }
    );

    // Check cached orientation first
    const { data: cachedOrient } = await supabase
      .from("orientacoes")
      .select("orientacao_voto")
      .eq("id_votacao", votacaoId)
      .in("sigla_orgao_politico", ["GOV.", "GOVERNO", "LIDGOV", "Gov."])
      .limit(1);

    let govOrientVoto: string | null = null;

    if (cachedOrient && cachedOrient.length > 0) {
      govOrientVoto = cachedOrient[0].orientacao_voto;
    } else {
      // Fetch from API
      try {
        const orientRes = await fetchWithRetry(
          `${API_BASE}/votacoes/${votacaoId}/orientacoes`
        );
        const orientData = await orientRes.json();
        const orientacoes = orientData.dados || [];

        const govOrient = orientacoes.find((o: any) =>
          ["GOV.", "GOVERNO", "LIDGOV"].includes(
            o.siglaOrgaoPolitico?.toUpperCase()
          )
        );

        if (govOrient) {
          govOrientVoto = govOrient.orientacaoVoto;
          await supabase.from("orientacoes").upsert(
            {
              id_votacao: votacaoId,
              sigla_orgao_politico: govOrient.siglaOrgaoPolitico,
              orientacao_voto: govOrient.orientacaoVoto,
            },
            { onConflict: "id_votacao,sigla_orgao_politico" }
          );
        }
      } catch {
        continue;
      }
    }

    if (govOrientVoto) {
      relevantVotes++;
      const votoNorm = vote.tipoVoto?.trim().toLowerCase();
      const orientNorm = govOrientVoto.trim().toLowerCase();
      if (votoNorm === orientNorm) aligned++;
    }

    await new Promise((r) => setTimeout(r, 50));
  }

  const score = relevantVotes > 0 ? (aligned / relevantVotes) * 100 : 0;
  let classificacao: string = "Centro";
  if (relevantVotes === 0) classificacao = "Sem Dados";
  else if (score >= 70) classificacao = "Governo";
  else if (score <= 35) classificacao = "Oposição";

  const record = {
    deputado_id: depId,
    deputado_nome: depInfo.nome || depInfo.nomeCivil || "N/A",
    deputado_partido: depInfo.siglaPartido || null,
    deputado_uf: depInfo.siglaUf || null,
    deputado_foto: depInfo.urlFoto || null,
    ano: year,
    score: Math.round(score * 100) / 100,
    total_votos: relevantVotes,
    votos_alinhados: aligned,
    classificacao: classificacao,
  };

  await supabase
    .from("analises_deputados")
    .upsert(record, { onConflict: "deputado_id,ano" });

  return record;
}
