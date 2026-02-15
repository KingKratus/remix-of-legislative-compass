import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BULK_BASE = "https://dadosabertos.camara.leg.br/arquivos";
const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeVoto(voto: string | null | undefined): string {
  if (!voto) return "";
  const v = voto.trim().toLowerCase();
  if (v === "sim" || v === "yes") return "sim";
  if (v === "não" || v === "nao" || v === "no") return "não";
  if (v.includes("abstenção") || v.includes("abstencao")) return "abstencao";
  if (v.includes("obstrução") || v.includes("obstrucao")) return "obstrucao";
  if (v.includes("ausente") || v.includes("ausência")) return "ausente";
  return v;
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
    const year: number = body.ano || new Date().getFullYear();
    const batchStart: number = body.batch_start || 0;
    const batchSize: number = body.batch_size || 30;

    console.log(`Sync year=${year} batch_start=${batchStart} batch_size=${batchSize}`);

    // ── STEP 1: Fetch orientações from bulk file (small ~3MB) ──
    const orientUrl = `${BULK_BASE}/votacoesOrientacoes/json/votacoesOrientacoes-${year}.json`;
    console.log(`Fetching orientações: ${orientUrl}`);
    const orientRes = await fetch(orientUrl);
    if (!orientRes.ok) {
      return jsonResponse(
        { error: `Não foi possível baixar orientações para ${year} (${orientRes.status})` },
        400
      );
    }
    const orientJson = await orientRes.json();
    const allOrientacoes = orientJson.dados || [];
    console.log(`Loaded ${allOrientacoes.length} orientações`);

    // Extract government orientations per votação
    const govOrientByVotacao: Record<string, string> = {};
    const govSiglas = ["governo", "gov.", "líder do governo", "lidgov"];

    for (const o of allOrientacoes) {
      const sigla = (o.siglaBancada || "").trim().toLowerCase();
      if (govSiglas.includes(sigla)) {
        const orient = (o.orientacao || "").trim();
        if (orient && orient.toLowerCase() !== "liberado") {
          govOrientByVotacao[String(o.idVotacao)] = orient;
        }
      }
    }

    const allVotacaoIds = Object.keys(govOrientByVotacao);
    const totalVotacoes = allVotacaoIds.length;
    console.log(`Total votações with gov orientation: ${totalVotacoes}`);

    if (totalVotacoes === 0) {
      return jsonResponse({
        done: true,
        processed: 0,
        total: 0,
        year,
        message: "Nenhuma votação com orientação do governo encontrada",
      });
    }

    // Cache orientações in DB on first batch only
    if (batchStart === 0) {
      const orientRecords = allOrientacoes.map((o: any) => ({
        id_votacao: String(o.idVotacao),
        sigla_orgao_politico: o.siglaBancada || "",
        orientacao_voto: o.orientacao || "",
      }));
      for (let i = 0; i < orientRecords.length; i += 500) {
        await supabase
          .from("orientacoes")
          .upsert(orientRecords.slice(i, i + 500), {
            onConflict: "id_votacao,sigla_orgao_politico",
          });
      }
      console.log(`Cached ${orientRecords.length} orientações in DB`);
    }

    // ── STEP 2: Process a batch of votações via REST API ──
    const batchIds = allVotacaoIds.slice(batchStart, batchStart + batchSize);
    if (batchIds.length === 0) {
      return jsonResponse({
        done: true,
        processed: batchStart,
        total: totalVotacoes,
        year,
      });
    }

    console.log(`Processing batch: votações ${batchStart} to ${batchStart + batchIds.length}`);

    // Accumulate scores across this batch
    const deputyScores: Record<
      number,
      { aligned: number; relevant: number; nome: string; partido: string; uf: string; foto: string }
    > = {};

    // Load existing partial scores from DB for this year (to merge with)
    const { data: existingAnalises } = await supabase
      .from("analises_deputados")
      .select("deputado_id, votos_alinhados, total_votos, deputado_nome, deputado_partido, deputado_uf, deputado_foto")
      .eq("ano", year);

    if (existingAnalises && batchStart > 0) {
      for (const a of existingAnalises) {
        deputyScores[a.deputado_id] = {
          aligned: a.votos_alinhados,
          relevant: a.total_votos,
          nome: a.deputado_nome,
          partido: a.deputado_partido || "",
          uf: a.deputado_uf || "",
          foto: a.deputado_foto || "",
        };
      }
    }

    // Fetch votes for each votação in this batch
    for (const votacaoId of batchIds) {
      const govOrient = govOrientByVotacao[votacaoId];
      try {
        const votosUrl = `${API_BASE}/votacoes/${votacaoId}/votos`;
        const res = await fetch(votosUrl);

        if (res.status === 429) {
          console.warn(`Rate limited on ${votacaoId}, waiting 2s...`);
          await sleep(2000);
          const retryRes = await fetch(votosUrl);
          if (!retryRes.ok) {
            console.error(`Skipping ${votacaoId} after retry (${retryRes.status})`);
            continue;
          }
          const retryJson = await retryRes.json();
          processVotos(retryJson.dados || [], votacaoId, govOrient, deputyScores);
        } else if (!res.ok) {
          console.error(`Skipping ${votacaoId} (${res.status})`);
          continue;
        } else {
          const json = await res.json();
          processVotos(json.dados || [], votacaoId, govOrient, deputyScores);
        }

        // Small delay to avoid rate limits
        await sleep(300);
      } catch (err) {
        console.error(`Error fetching votes for ${votacaoId}: ${err.message}`);
      }
    }

    // ── STEP 3: Classify and upsert results ──
    const records: any[] = [];
    for (const [depIdStr, data] of Object.entries(deputyScores)) {
      const depId = Number(depIdStr);
      const score = data.relevant > 0 ? (data.aligned / data.relevant) * 100 : 0;
      let classificacao = "Centro";
      if (data.relevant === 0) classificacao = "Sem Dados";
      else if (score >= 70) classificacao = "Governo";
      else if (score <= 35) classificacao = "Oposição";

      records.push({
        deputado_id: depId,
        deputado_nome: data.nome,
        deputado_partido: data.partido || null,
        deputado_uf: data.uf || null,
        deputado_foto: data.foto || null,
        ano: year,
        score: Math.round(score * 100) / 100,
        total_votos: data.relevant,
        votos_alinhados: data.aligned,
        classificacao,
      });
    }

    let upsertCount = 0;
    for (let i = 0; i < records.length; i += 200) {
      const chunk = records.slice(i, i + 200);
      const { error: upsertError } = await supabase
        .from("analises_deputados")
        .upsert(chunk, { onConflict: "deputado_id,ano" });
      if (upsertError) {
        console.error(`Upsert error: ${upsertError.message}`);
      } else {
        upsertCount += chunk.length;
      }
    }

    // Cache votação metadata
    const votacaoRecords = batchIds.map((id) => ({
      id_votacao: id,
      data: null,
      descricao: null,
      ano: year,
      sigla_orgao: null,
    }));
    for (let i = 0; i < votacaoRecords.length; i += 500) {
      await supabase
        .from("votacoes")
        .upsert(votacaoRecords.slice(i, i + 500), { onConflict: "id_votacao" });
    }

    const nextStart = batchStart + batchSize;
    const done = nextStart >= totalVotacoes;

    console.log(
      `Batch done: upserted ${upsertCount} deputies, processed ${Math.min(nextStart, totalVotacoes)}/${totalVotacoes} votações`
    );

    return jsonResponse({
      done,
      processed: Math.min(nextStart, totalVotacoes),
      total: totalVotacoes,
      batch_deputies: upsertCount,
      year,
      next_batch_start: done ? null : nextStart,
    });
  } catch (error) {
    console.error("Fatal error:", error.message, error.stack);
    return jsonResponse({ error: error.message }, 500);
  }
});

function processVotos(
  votos: any[],
  votacaoId: string,
  govOrient: string,
  deputyScores: Record<number, { aligned: number; relevant: number; nome: string; partido: string; uf: string; foto: string }>
) {
  const govNorm = normalizeVoto(govOrient);

  for (const voto of votos) {
    const depId = voto.deputado_?.id;
    if (!depId) continue;
    const id = Number(depId);

    if (!deputyScores[id]) {
      deputyScores[id] = {
        aligned: 0,
        relevant: 0,
        nome: voto.deputado_?.nome || "N/A",
        partido: voto.deputado_?.siglaPartido || "",
        uf: voto.deputado_?.siglaUf || "",
        foto: voto.deputado_?.urlFoto || "",
      };
    }

    const depVoto = normalizeVoto(voto.tipoVoto);
    if (depVoto === "abstencao" || depVoto === "ausente" || depVoto === "obstrucao" || depVoto === "") {
      continue;
    }

    deputyScores[id].relevant++;
    if (depVoto === govNorm) {
      deputyScores[id].aligned++;
    }
  }
}
