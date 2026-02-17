import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BULK_BASE = "https://dadosabertos.camara.leg.br/arquivos";
const API_BASE = "https://dadosabertos.camara.leg.br/api/v2";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

function processVotos(
  votos: any[],
  _votacaoId: string,
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
        aligned: 0, relevant: 0,
        nome: voto.deputado_?.nome || "N/A",
        partido: voto.deputado_?.siglaPartido || "",
        uf: voto.deputado_?.siglaUf || "",
        foto: voto.deputado_?.urlFoto || "",
      };
    }
    const depVoto = normalizeVoto(voto.tipoVoto);
    if (!depVoto || depVoto === "abstencao" || depVoto === "ausente" || depVoto === "obstrucao") continue;
    deputyScores[id].relevant++;
    if (depVoto === govNorm) deputyScores[id].aligned++;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const year = new Date().getFullYear();
    const batchSize = 30;

    console.log(`[auto-sync] Starting full sync for year ${year}`);

    // Step 1: Fetch orientações
    const orientUrl = `${BULK_BASE}/votacoesOrientacoes/json/votacoesOrientacoes-${year}.json`;
    const orientRes = await fetch(orientUrl);
    if (!orientRes.ok) {
      console.error(`[auto-sync] Failed to fetch orientações: ${orientRes.status}`);
      return new Response(JSON.stringify({ error: "Failed to fetch orientações" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orientJson = await orientRes.json();
    const allOrientacoes = orientJson.dados || [];
    const govSiglas = ["governo", "gov.", "líder do governo", "lidgov"];
    const govOrientByVotacao: Record<string, string> = {};

    for (const o of allOrientacoes) {
      const sigla = (o.siglaBancada || "").trim().toLowerCase();
      if (govSiglas.includes(sigla)) {
        const orient = (o.orientacao || "").trim();
        if (orient && orient.toLowerCase() !== "liberado") {
          govOrientByVotacao[String(o.idVotacao)] = orient;
        }
      }
    }

    // Cache orientações
    const orientRecords = allOrientacoes.map((o: any) => ({
      id_votacao: String(o.idVotacao),
      sigla_orgao_politico: o.siglaBancada || "",
      orientacao_voto: o.orientacao || "",
    }));
    for (let i = 0; i < orientRecords.length; i += 500) {
      await supabase.from("orientacoes").upsert(orientRecords.slice(i, i + 500), {
        onConflict: "id_votacao,sigla_orgao_politico",
      });
    }

    const allVotacaoIds = Object.keys(govOrientByVotacao);
    const totalVotacoes = allVotacaoIds.length;
    console.log(`[auto-sync] ${totalVotacoes} votações with gov orientation`);

    if (totalVotacoes === 0) {
      return new Response(JSON.stringify({ done: true, total: 0, year }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Process all batches
    const deputyScores: Record<number, { aligned: number; relevant: number; nome: string; partido: string; uf: string; foto: string }> = {};
    let processed = 0;

    for (let batchStart = 0; batchStart < totalVotacoes; batchStart += batchSize) {
      const batchIds = allVotacaoIds.slice(batchStart, batchStart + batchSize);

      for (const votacaoId of batchIds) {
        const govOrient = govOrientByVotacao[votacaoId];
        try {
          const votosUrl = `${API_BASE}/votacoes/${votacaoId}/votos`;
          let res = await fetch(votosUrl);

          if (res.status === 429) {
            console.warn(`[auto-sync] Rate limited on ${votacaoId}, waiting 3s...`);
            await sleep(3000);
            res = await fetch(votosUrl);
          }

          if (res.ok) {
            const json = await res.json();
            processVotos(json.dados || [], votacaoId, govOrient, deputyScores);
          } else {
            console.error(`[auto-sync] Skipping ${votacaoId} (${res.status})`);
          }

          await sleep(350);
        } catch (err) {
          console.error(`[auto-sync] Error on ${votacaoId}: ${(err as Error).message}`);
        }
      }

      processed += batchIds.length;
      console.log(`[auto-sync] Progress: ${processed}/${totalVotacoes}`);
    }

    // Step 3: Classify and upsert
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
      const { error } = await supabase
        .from("analises_deputados")
        .upsert(chunk, { onConflict: "deputado_id,ano" });
      if (error) {
        console.error(`[auto-sync] Upsert error: ${error.message}`);
      } else {
        upsertCount += chunk.length;
      }
    }

    // Cache votação metadata
    const votacaoRecords = allVotacaoIds.map((id) => ({
      id_votacao: id, data: null, descricao: null, ano: year, sigla_orgao: null,
    }));
    for (let i = 0; i < votacaoRecords.length; i += 500) {
      await supabase.from("votacoes").upsert(votacaoRecords.slice(i, i + 500), { onConflict: "id_votacao" });
    }

    console.log(`[auto-sync] Done! Upserted ${upsertCount} deputies, ${totalVotacoes} votações`);

    return new Response(JSON.stringify({
      done: true,
      deputies: upsertCount,
      votacoes: totalVotacoes,
      year,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`[auto-sync] Fatal error: ${(error as Error).message}`);
    return new Response(JSON.stringify({ error: "Auto-sync failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
