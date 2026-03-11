export type Regiao = "Norte" | "Nordeste" | "Centro-Oeste" | "Sudeste" | "Sul";

export const UF_REGIAO: Record<string, Regiao> = {
  AC: "Norte", AP: "Norte", AM: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste",
  PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MT: "Centro-Oeste", MS: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

export const REGIOES: Regiao[] = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"];

export function getRegiao(uf: string | null | undefined): Regiao | null {
  if (!uf) return null;
  return UF_REGIAO[uf.toUpperCase()] || null;
}
