import type { EvidenceItem } from "./types";

export type HistoricalSource = { title: string; url: string; extract: string };

export async function retrieveHistoricalSources(place: string, period: string): Promise<HistoricalSource[]> {
  const endpoint = new URL("https://api.wikimedia.org/core/v1/wikipedia/en/search/page");
  endpoint.searchParams.set("q", `${place} history ${period}`);
  endpoint.searchParams.set("limit", "4");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(endpoint, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Jagantara/1.0 (heritage research demo)",
        "Api-User-Agent": "Jagantara/1.0 (heritage research demo)",
      },
    });
    if (!response.ok) {
      console.warn(`Historical source retrieval failed with status ${response.status}.`);
      return [];
    }
    const payload = (await response.json()) as { pages?: Array<{ key?: string; title?: string; excerpt?: string; description?: string }> };
    return (payload.pages || []).map((page) => ({
      title: page.title || "Untitled source",
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.key || page.title || "")}`,
      extract: stripSearchMarkup(page.excerpt || page.description || "").slice(0, 2_500),
    })).filter((source) => source.extract && source.url);
  } catch (error) {
    console.warn("Historical source retrieval failed.", error instanceof Error ? error.message : "Unknown error");
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function stripSearchMarkup(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function sourcesAsConservativeTimeline(sources: HistoricalSource[]): EvidenceItem[] {
  return sources.slice(0, 3).map((source, index) => ({
    id: `history:source-${index}`,
    title: `Research lead: ${source.title}`,
    body: "A relevant source was retrieved, but no dated claim was extracted without a configured composition model. Open the source to continue the research.",
    evidenceType: "SOURCE_BACKED_HISTORY",
    sourceUrl: source.url,
    sourceTitle: source.title,
    supportingExcerpt: source.extract,
  }));
}
