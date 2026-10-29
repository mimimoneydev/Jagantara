import type { EvidenceItem } from "./types";
const STOP = new Set("a an and are as at be by for from has in into is it its of on or that the their this to was were with".split(" "));

export function entailmentScore(claim: string, excerpt: string) {
  const claimTokens = tokens(claim), sourceTokens = new Set(tokens(excerpt));
  if (!claimTokens.length || !sourceTokens.size) return 0;
  const overlap = claimTokens.filter((token) => sourceTokens.has(token)).length / claimTokens.length;
  const years = claim.match(/\b(?:1[5-9]|20)\d{2}\b/g) || [];
  return years.every((year) => excerpt.includes(year)) ? overlap : Math.min(overlap, .34);
}
export function verifyEvidence(item: EvidenceItem): EvidenceItem {
  if (item.evidenceType !== "SOURCE_BACKED_HISTORY") return item;
  const score = item.supportingExcerpt ? entailmentScore(`${item.title} ${item.body}`, item.supportingExcerpt) : 0;
  return { ...item, entailment: { status: isHttpUrl(item.sourceUrl) && score >= .42 ? "verified" : "rejected", score: +score.toFixed(3), method: "verbatim-source-overlap-v1" } };
}
export function validateEvidence(items: EvidenceItem[]) { return claimCheck(items).accepted; }
export function claimCheck(items: EvidenceItem[]) {
  const accepted: EvidenceItem[] = [], rejected: EvidenceItem[] = [];
  for (const original of items) {
    const item = verifyEvidence(original);
    const validHistory = item.evidenceType !== "SOURCE_BACKED_HISTORY" || item.entailment?.status === "verified";
    const validQloo = item.evidenceType !== "QLOO_TASTE_CONNECTION" || item.id.startsWith("qloo:");
    (validHistory && validQloo ? accepted : rejected).push(item);
  }
  return { accepted, rejected };
}
function tokens(value: string) { return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 2 && !STOP.has(t)); }
function isHttpUrl(value?: string) { if (!value) return false; try { return ["https:", "http:"].includes(new URL(value).protocol); } catch { return false; } }
