import type { EvidenceItem, JourneyInput, MediaItem } from "./types";
import type { HistoricalSource } from "./history";

export async function composeWithOpenRouter(input: JourneyInput, sources: HistoricalSource[]): Promise<{ timeline: EvidenceItem[]; narrative: EvidenceItem[] } | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL || "deepseek/deepseek-v4.1-flash";
  if ((process.env.LLM_PROVIDER || "none") !== "openrouter" || !apiKey || !sources.length) return null;
  const sourcePacket = sources.map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.extract}`).join("\n\n");
  const prompt = `You are the composition step in an evidence-aware heritage research workflow.
Create JSON only with keys timeline and narrative. Timeline has at most 4 concise objects: title, body, year (optional), sourceIndex. Every historical claim must be directly supported by exactly one supplied source. Reject anything unsupported. Narrative has 1 or 2 objects: title, body, evidenceType. evidenceType must be FAMILY_TESTIMONY when paraphrasing the user's stated connection or supplied memory, otherwise CREATIVE_RECONSTRUCTION. Never infer ethnicity, genealogy, or identity. Clearly state that reconstruction is imagined.

Place: ${input.place}\nPeriod: ${input.period}\nUser's stated connection to the place: ${input.connection || "None supplied"}\nMemory attributed to the user: ${input.memory || "None supplied"}\n\nSources:\n${sourcePacket}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        "x-title": "Jagantara",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        temperature: 0.2,
        max_tokens: 1800,
      }),
    });
    if (!response.ok) {
      console.warn(`OpenRouter composition failed with status ${response.status}.`);
      return null;
    }
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      console.warn("OpenRouter composition returned no message content.");
      return null;
    }
    const result = JSON.parse(text) as { timeline?: Array<Record<string, unknown>>; narrative?: Array<Record<string, unknown>> };
    const timeline = (result.timeline || []).flatMap((item, index) => {
      const sourceIndex = Number(item.sourceIndex) - 1;
      const source = sources[sourceIndex];
      if (!source || typeof item.title !== "string" || typeof item.body !== "string") return [];
      return [{ id: `history:generated-${index}`, title: item.title, body: item.body, year: typeof item.year === "number" ? item.year : undefined, evidenceType: "SOURCE_BACKED_HISTORY" as const, sourceUrl: source.url, sourceTitle: source.title }];
    });
    const narrative = (result.narrative || []).flatMap((item, index) => {
      if (typeof item.title !== "string" || typeof item.body !== "string") return [];
      const evidenceType = item.evidenceType === "FAMILY_TESTIMONY" ? "FAMILY_TESTIMONY" as const : "CREATIVE_RECONSTRUCTION" as const;
      return [{ id: `${evidenceType === "FAMILY_TESTIMONY" ? "testimony" : "reconstruction"}:generated-${index}`, title: item.title, body: item.body, evidenceType, sourceTitle: evidenceType === "FAMILY_TESTIMONY" ? "User-provided memory" : undefined }];
    });
    return { timeline, narrative };
  } catch (error) {
    console.warn("OpenRouter composition failed.", error instanceof Error ? error.message : "Unknown error");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function describeMediaWithOpenRouter(input: JourneyInput, media: MediaItem[]): Promise<MediaItem[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.LLM_MODEL || "deepseek/deepseek-v4.1-flash";
  if ((process.env.LLM_PROVIDER || "none") !== "openrouter" || !apiKey || !media.length) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, "x-title": "Jagantara" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [{
          role: "user",
          content: `Write one concise, accessible description for each allowlisted media item in this ${input.place} cultural-history sample. Use only the supplied title, creator, media type, and editorial note. Do not infer ancestry, ownership, dates, or historical facts. Return JSON only as {"descriptions":[{"id":"...","description":"..."}]}.

${media.map((item) => `${item.id} | ${item.title} | ${item.creator} | ${item.mediaType} | ${item.description}`).join("\n")}`,
        }],
        response_format: { type: "json_object" },
        reasoning: { enabled: false },
        temperature: 0.2,
        max_tokens: 450,
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text) as { descriptions?: Array<{ id?: unknown; description?: unknown }> };
    const allowedIds = new Set(media.map((item) => item.id));
    const descriptions = new Map((parsed.descriptions || []).flatMap((item) =>
      typeof item.id === "string" && allowedIds.has(item.id) && typeof item.description === "string" && item.description.trim()
        ? [[item.id, item.description.replace(/[<>]/g, "").trim().slice(0, 280)] as const]
        : []));
    if (!descriptions.size) return null;
    return media.map((item) => ({ ...item, description: descriptions.get(item.id) || item.description }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
