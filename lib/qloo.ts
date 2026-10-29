import type { Discovery, QlooEntity, ServiceState } from "./types";

const QLOO_HACKATHON_BASE_URL = "https://hackathon.api.qloo.com";
const QLOO_REQUEST_TIMEOUT_MS = 25_000;
const MAX_CACHE_ENTRIES = 64;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { expires: number; value: unknown }>();

type QlooRawEntity = Record<string, unknown>;

export class QlooError extends Error {
  constructor(
    message: string,
    public readonly state: ServiceState,
  ) {
    super(message);
  }
}

export async function resolveQlooInterests(interests: string[]): Promise<QlooEntity[]> {
  const resolved: QlooEntity[] = [];
  for (const interest of interests) {
    const payload = await qlooGet("/search", { query: interest, take: "5", sort_by: "match" });
    const candidates = extractEntities(payload);
    const best = candidates[0];
    if (best) {
      const entity = normalizeEntity(best);
      // Insights accepts Qloo entity IDs, never the original free-form query.
      if (entity.id) resolved.push(entity);
    }
  }
  return resolved;
}

export async function getQlooDiscoveries(entities: QlooEntity[]) {
  if (!entities.length) {
    return { discoveries: [] as Discovery[], state: { status: "empty", message: "Qloo could not resolve the selected interests, so no Insights request was made." } satisfies ServiceState };
  }

  const categories = [
    ["music", "urn:entity:artist"],
    ["books", "urn:entity:book"],
    ["film", "urn:entity:movie"],
    ["destinations", "urn:entity:destination"],
  ] as const;
  const discoveries: Discovery[] = [];
  for (const [category, type] of categories) {
    const payload = await qlooGet("/v2/insights", {
      "filter.type": type,
      "signal.interests.entities": entities.map((entity) => entity.id).join(","),
      "feature.explainability": "true",
      take: "3",
    });
    for (const raw of extractEntities(payload).slice(0, 3)) {
      const discovery = normalizeDiscovery(raw, category, entities);
      if (discovery) discoveries.push(discovery);
    }
  }

  return {
    discoveries,
    state: discoveries.length
      ? ({ status: "live", message: "Live Qloo entity resolution and Insights results. Affinities are aggregate cultural connections, not personal or historical evidence." } satisfies ServiceState)
      : ({ status: "empty", message: "Qloo returned no discoveries for this combination. Nothing was substituted." } satisfies ServiceState),
  };
}

export function extractEntities(payload: unknown): QlooRawEntity[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  const candidates = [
    root.results,
    (root.results as Record<string, unknown> | undefined)?.entities,
    root.entities,
    (root.data as Record<string, unknown> | undefined)?.results,
    ((root.data as Record<string, unknown> | undefined)?.results as Record<string, unknown> | undefined)?.entities,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.filter((item): item is QlooRawEntity => !!item && typeof item === "object");
  }
  return [];
}

export function normalizeEntity(raw: QlooRawEntity): QlooEntity {
  const id = stringValue(raw.entity_id) || stringValue(raw.id);
  return {
    id,
    name: stringValue(raw.name) || "Untitled Qloo entity",
    type: stringValue(raw.subtype) || stringValue(raw.type) || "urn:entity",
  };
}

function normalizeDiscovery(raw: QlooRawEntity, category: Discovery["category"], signals: QlooEntity[]): Discovery | null {
  const entity = normalizeEntity(raw);
  if (!entity.id) return null;
  const properties = objectValue(raw.properties);
  const query = objectValue(raw.query);
  const explainability = objectValue(query.explainability);
  const signalScores = Object.entries(explainability)
    .filter(([, value]) => typeof value === "number")
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const explanation = signalScores.length
    ? signalScores.slice(0, 3).map(([id, score]) => `${signals.find((signal) => signal.id === id)?.name || "Selected interest"} contributed ${Math.round(Number(score) * 100)}% of the displayed explanation score.`)
    : signals.slice(0, 2).map((signal) => `Connected by Qloo to the resolved entity “${signal.name}”; this is an aggregate affinity, not a claim about you.`);
  const affinity = numberValue(raw.affinity) ?? numberValue(raw.score) ?? numberValue(query.affinity);
  return {
    id: `qloo:${entity.id}`,
    qlooEntityId: entity.id,
    title: entity.name,
    body: stringValue(properties.description) || `A Qloo ${category} connection based on the selected cultural signals.`,
    evidenceType: "QLOO_TASTE_CONNECTION",
    category,
    imageUrl: imageUrl(properties.image),
    explanation,
    affinity,
  };
}

async function qlooGet(path: string, params: Record<string, string>): Promise<unknown> {
  const apiKey = process.env.QLOO_API_KEY?.trim();
  if (!apiKey) throw new QlooError("QLOO_API_KEY is not configured.", { status: "unconfigured", message: "Qloo is not configured. No recommendations were generated." });
  const url = new URL(path, qlooBaseUrl());
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;

  const response = await boundedFetch(url, apiKey);
  if (response.status === 401) {
    throw new QlooError("Qloo rejected the credential.", { status: "unauthorized", message: "Qloo authentication failed. The server did not fall back to invented results." });
  }
  if (response.status === 403) {
    throw new QlooError("Qloo rejected the requested entity type.", { status: "error", message: "Qloo does not permit one of the requested entity types. No substitute results were used." });
  }
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new QlooError("Qloo rate limit reached.", { status: "rate_limited", message: "Qloo rate limit reached. Try again after the indicated window.", retryAfterSeconds: Number.isFinite(retryAfter) ? retryAfter : undefined });
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    throw new QlooError(`Qloo request failed (${response.status}).`, { status: "error", message: response.status === 400 ? `Qloo could not support this query or region. ${detail}` : `Qloo request failed with status ${response.status}. No substitute results were used.` });
  }
  const payload = await response.json();
  setCache(cacheKey, payload);
  return payload;
}

async function boundedFetch(url: URL, apiKey: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QLOO_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, { method: "GET", headers: { accept: "application/json", "X-Api-Key": apiKey }, signal: controller.signal });
    } catch (error) {
      if (attempt === 1) throw new QlooError("Qloo timed out.", { status: "timeout", message: "Qloo timed out after two bounded attempts. No recommendations were fabricated." });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (!(error instanceof Error)) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new QlooError("Qloo request failed.", { status: "error", message: "Qloo could not be reached. No recommendations were fabricated." });
}

function qlooBaseUrl() {
  const configured = process.env.QLOO_BASE_URL?.trim() || QLOO_HACKATHON_BASE_URL;
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new QlooError("QLOO_BASE_URL is invalid.", { status: "error", message: "Qloo is misconfigured: QLOO_BASE_URL must be the official hackathon URL." });
  }
  if (url.origin !== QLOO_HACKATHON_BASE_URL || (url.pathname !== "/" && url.pathname !== "")) {
    throw new QlooError("QLOO_BASE_URL is not the hackathon environment.", { status: "error", message: `Qloo is misconfigured: hackathon keys require ${QLOO_HACKATHON_BASE_URL}.` });
  }
  return QLOO_HACKATHON_BASE_URL;
}

function setCache(key: string, value: unknown) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown) { return typeof value === "number" ? value : undefined; }
function imageUrl(value: unknown) {
  if (typeof value === "string") return value;
  return stringValue(objectValue(value).url) || undefined;
}
