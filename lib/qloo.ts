import type { Discovery, QlooEntity, ServiceState } from "./types";

const BASE = "https://hackathon.api.qloo.com";
const cache = new Map<string, { expires: number; value: unknown }>();
type Raw = Record<string, unknown>;
type Intent = { query: string; kind: "entity" | "tag"; expectedType?: string };
const SEEDED: Record<string, string> = {
  "joy harjo": "urn:entity:person", "colm toibin": "urn:entity:person",
  "duke ellington": "urn:entity:artist", "langston hughes": "urn:entity:person",
};

export class QlooError extends Error {
  constructor(message: string, public readonly state: ServiceState) { super(message); }
}

export function classifySignal(query: string): Intent {
  const expectedType = SEEDED[norm(query)];
  if (expectedType) return { query, kind: "entity", expectedType };
  if (/\b(band|orchestra|ensemble|singer|rapper|musician|quartet)\b/i.test(query))
    return { query, kind: "entity", expectedType: "urn:entity:artist" };
  return { query, kind: "tag" };
}

export async function resolveQlooInterests(interests: string[]): Promise<QlooEntity[]> {
  const settled = await Promise.allSettled(interests.map((query) => resolveOne(classifySignal(query))));
  const good = settled.flatMap((r) => r.status === "fulfilled" && r.value ? [r.value] : []);
  if (!good.length) {
    const error = settled.flatMap((r) => r.status === "rejected" ? [r.reason] : []).find((e) => e instanceof QlooError);
    if (error) throw error;
  }
  return [...new Map(good.map((signal) => [signal.id, signal])).values()];
}

async function resolveOne(intent: Intent): Promise<QlooEntity | null> {
  const payload = intent.kind === "tag"
    ? await qlooGet("/v2/tags", { query: intent.query, take: "8" })
    : await qlooGet("/search", { query: intent.query, take: "8", sort_by: "match", ...(intent.expectedType ? { types: intent.expectedType } : {}) });
  const ranked = (intent.kind === "tag" ? extractTags(payload) : extractEntities(payload))
    .map((raw) => ({ entity: normalizeEntity(raw, intent.kind), score: candidateScore(intent, raw) }))
    .filter((item) => item.entity.id).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const second = ranked.find((item) => item.entity.id !== best?.entity.id && norm(item.entity.name) !== norm(best?.entity.name || ""));
  const ambiguous = Boolean(second && best.score < .98 && best.score - second.score < .08);
  const typeOk = !intent.expectedType || best?.entity.type === intent.expectedType || best?.entity.type.endsWith(intent.expectedType.split(":").at(-1)!);
  if (!best || best.score < (intent.kind === "entity" ? .72 : .56) || ambiguous || !typeOk) return null;
  return { ...best.entity, query: intent.query, signalKind: intent.kind, confidence: +best.score.toFixed(3), verified: true };
}

export async function getQlooDiscoveries(signals: QlooEntity[]) {
  const verified = signals.filter((s) => s.verified !== false && s.id);
  if (!verified.length) return { discoveries: [] as Discovery[], state: { status: "empty", message: "No taste signals passed name, type, and ambiguity checks; Insights was not queried." } satisfies ServiceState };
  const categories = [["music", "urn:entity:artist"], ["books", "urn:entity:book"], ["film", "urn:entity:movie"], ["destinations", "urn:entity:destination"]] as const;
  const entities = verified.filter((s) => s.signalKind !== "tag");
  const tags = verified.filter((s) => s.signalKind === "tag");
  const settled = await Promise.allSettled(categories.map(async ([category, type]) => {
    const payload = await qlooGet("/v2/insights", {
      "filter.type": type,
      ...(entities.length ? { "signal.interests.entities": entities.map((s) => s.id).join(",") } : {}),
      ...(tags.length ? { "signal.interests.tags": tags.map((s) => s.id).join(",") } : {}),
      "feature.explainability": "true", take: "3",
    });
    return extractEntities(payload).slice(0, 3).flatMap((raw) => {
      const value = normalizeDiscovery(raw, category, verified); return value ? [value] : [];
    });
  }));
  const discoveries = settled.flatMap((r) => r.status === "fulfilled" ? r.value : []);
  const failures = settled.filter((r) => r.status === "rejected").length;
  if (!discoveries.length) {
    const error = settled.flatMap((r) => r.status === "rejected" ? [r.reason] : []).find((e) => e instanceof QlooError) as QlooError | undefined;
    if (error) return { discoveries, state: error.state };
  }
  return { discoveries, state: discoveries.length
    ? { status: "live", message: failures ? `Live Qloo route built from ${4 - failures} of 4 categories; partial failures remain visible.` : "Live Qloo route built from verified entity and tag signals across four categories." }
    : { status: "empty", message: "Qloo returned no verified discoveries; nothing was substituted." } } as { discoveries: Discovery[]; state: ServiceState };
}

export function extractEntities(payload: unknown): Raw[] { return extract(payload, "entities"); }
export function extractTags(payload: unknown): Raw[] { return extract(payload, "tags"); }
function extract(payload: unknown, key: "entities" | "tags") {
  if (!isRecord(payload)) return [];
  const data = obj(payload.data), results = obj(payload.results), dataResults = obj(data.results);
  for (const value of [payload.results, results[key], payload[key], data.results, dataResults[key], data[key]])
    if (Array.isArray(value)) return value.filter(isRecord);
  return [];
}

export function normalizeEntity(raw: Raw, kind: "entity" | "tag" = "entity"): QlooEntity {
  const type = raw.subtype ?? raw.type ?? raw.types;
  return {
    id: str(raw.entity_id) || str(raw.tag_id) || str(raw.id),
    name: str(raw.name) || str(raw.tag_name) || str(raw.value) || "Untitled Qloo signal",
    type: kind === "tag" ? "urn:tag" : typeof type === "string" ? type : Array.isArray(type) ? str(type[0]) : str(obj(type).id) || "urn:entity",
    signalKind: kind,
  };
}

export function candidateScore(intent: Intent, raw: Raw) {
  const entity = normalizeEntity(raw, intent.kind), q = norm(intent.query), n = norm(entity.name);
  if (!q || !n) return 0;
  const qt = new Set(q.split(" ")), nt = new Set(n.split(" "));
  const intersection = [...qt].filter((t) => nt.has(t)).length, union = new Set([...qt, ...nt]).size || 1;
  const containment = n.includes(q) || q.includes(n) ? Math.min(q.length, n.length) / Math.max(q.length, n.length) : 0;
  const lexical = q === n ? 1 : (intersection / union) * .82 + containment * .18;
  const provider = num(raw.score) ?? num(raw.match) ?? 0;
  const typeBonus = intent.expectedType && (entity.type === intent.expectedType || entity.type.endsWith(intent.expectedType.split(":").at(-1)!)) ? .08 : 0;
  return Math.min(1, Math.max(lexical, provider * .75) + typeBonus);
}

function normalizeDiscovery(raw: Raw, category: Discovery["category"], signals: QlooEntity[]): Discovery | null {
  const entity = normalizeEntity(raw); if (!entity.id) return null;
  const properties = obj(raw.properties), query = obj(raw.query), explain = obj(query.explainability);
  const scores = Object.entries(explain).filter(([, v]) => typeof v === "number").sort((a, b) => Number(b[1]) - Number(a[1]));
  const explanation = scores.length
    ? scores.slice(0, 3).map(([id, score]) => `${signals.find((s) => s.id === id)?.name || "Verified signal"} contributed ${Math.round(Number(score) * 100)}% of Qloo's displayed explanation score.`)
    : signals.slice(0, 2).map((s) => `Connected by Qloo to verified ${s.signalKind} “${s.name}” (${Math.round((s.confidence || 1) * 100)}% resolver confidence).`);
  return { id: `qloo:${entity.id}`, qlooEntityId: entity.id, title: entity.name,
    body: str(properties.description) || `A live Qloo ${category} connection based on verified cultural signals.`,
    evidenceType: "QLOO_TASTE_CONNECTION", category, imageUrl: image(properties.image), explanation,
    affinity: num(raw.affinity) ?? num(raw.score) ?? num(query.affinity) };
}

async function qlooGet(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.QLOO_API_KEY?.trim();
  if (!key) throw new QlooError("Missing key", { status: "unconfigured", message: "Qloo is not configured; no recommendations were generated." });
  const url = new URL(path, qlooBase()); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const hit = cache.get(url.toString()); if (hit && hit.expires > Date.now()) return hit.value;
  const response = await resilientFetch(url, key);
  if (response.status === 401) throw new QlooError("Unauthorized", { status: "unauthorized", message: "Qloo authentication failed; no substitute results were used." });
  if (response.status === 403) throw new QlooError("Forbidden", { status: "error", message: "Qloo rejected a signal or entity type; no substitute results were used." });
  if (response.status === 429) throw new QlooError("Rate limited", { status: "rate_limited", message: "Qloo rate limit reached after a bounded retry; completed categories remain visible.", retryAfterSeconds: retryAfter(response.headers.get("retry-after")) });
  if (!response.ok) throw new QlooError("Request failed", { status: "error", message: `Qloo request failed with status ${response.status}; completed categories remain visible.` });
  const value = await response.json(); if (cache.size >= 96) cache.delete(cache.keys().next().value!); cache.set(url.toString(), { expires: Date.now() + 600_000, value }); return value;
}

async function resilientFetch(url: URL, key: string) {
  let last: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6_500);
    try {
      const response = await fetch(url, { method: "GET", headers: { accept: "application/json", "X-Api-Key": key }, signal: controller.signal });
      if ((response.status !== 429 && response.status < 500) || attempt === 1) return response;
      await wait(response.status === 429 ? Math.min(1200, (retryAfter(response.headers.get("retry-after")) || .2) * 1000) : 180);
    } catch (error) { last = error; if (!attempt) await wait(180); }
    finally { clearTimeout(timer); }
  }
  const timeout = last instanceof Error && last.name === "AbortError";
  throw new QlooError("Unavailable", { status: timeout ? "timeout" : "error", message: timeout ? "Qloo exceeded its 13-second bounded request budget; no recommendations were fabricated." : "Qloo could not be reached; no recommendations were fabricated." });
}

function qlooBase() {
  const configured = process.env.QLOO_BASE_URL?.trim() || BASE; let url: URL;
  try { url = new URL(configured); } catch { throw new QlooError("Invalid base", { status: "error", message: "QLOO_BASE_URL must be the official hackathon URL." }); }
  if (url.origin !== BASE || !["", "/"].includes(url.pathname)) throw new QlooError("Wrong base", { status: "error", message: `Qloo is misconfigured: hackathon keys require ${BASE}.` });
  return BASE;
}
function norm(v: string) { return v.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function retryAfter(v: string | null) { if (!v) return undefined; const n = Number(v); return Number.isFinite(n) ? Math.max(0, n) : undefined; }
function isRecord(v: unknown): v is Raw { return Boolean(v) && typeof v === "object" && !Array.isArray(v); }
function obj(v: unknown): Raw { return isRecord(v) ? v : {}; }
function str(v: unknown) { return typeof v === "string" ? v : ""; }
function num(v: unknown) { return typeof v === "number" ? v : undefined; }
function image(v: unknown) { return typeof v === "string" ? v : str(obj(v).url) || undefined; }
function wait(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
