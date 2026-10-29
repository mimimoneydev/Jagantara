import type { EvidenceItem } from "./types";

export function validateEvidence(items: EvidenceItem[]): EvidenceItem[] {
  return items.filter((item) => {
    if (item.evidenceType === "SOURCE_BACKED_HISTORY") return isHttpUrl(item.sourceUrl);
    if (item.evidenceType === "QLOO_TASTE_CONNECTION") return item.id.startsWith("qloo:");
    return true;
  });
}

export function claimCheck(items: EvidenceItem[]) {
  const accepted: EvidenceItem[] = [];
  const rejected: EvidenceItem[] = [];
  for (const item of items) {
    const validHistory = item.evidenceType !== "SOURCE_BACKED_HISTORY" || isHttpUrl(item.sourceUrl);
    const validQloo = item.evidenceType !== "QLOO_TASTE_CONNECTION" || item.id.startsWith("qloo:");
    (validHistory && validQloo ? accepted : rejected).push(item);
  }
  return { accepted, rejected };
}

function isHttpUrl(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
