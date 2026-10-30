import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { runHeritageAgent } from "../lib/agent";
import { baseDemoResult, demoInput, demoProfiles, demoSampleOrder, demoSamples, getDemoSample } from "../lib/demo";
import { claimCheck } from "../lib/evidence";
import { retrieveHistoricalSources } from "../lib/history";
import { parseJourneyInput } from "../lib/input";
import { extractEntities, extractTags, getQlooDiscoveries, QlooError, resolveQlooInterests } from "../lib/qloo";
import { composeWithOpenRouter, describeMediaWithOpenRouter } from "../lib/openrouter";

const originalFetch = globalThis.fetch;
const originalKey = process.env.QLOO_API_KEY;
const originalQlooBaseUrl = process.env.QLOO_BASE_URL;
const originalLlmProvider = process.env.LLM_PROVIDER;
const originalLlmModel = process.env.LLM_MODEL;
const originalOpenRouterKey = process.env.OPENROUTER_API_KEY;

beforeEach(() => {
  process.env.QLOO_API_KEY = "test-only-key";
  process.env.QLOO_BASE_URL = "https://hackathon.api.qloo.com";
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.QLOO_API_KEY;
  else process.env.QLOO_API_KEY = originalKey;
  if (originalQlooBaseUrl === undefined) delete process.env.QLOO_BASE_URL;
  else process.env.QLOO_BASE_URL = originalQlooBaseUrl;
  if (originalLlmProvider === undefined) delete process.env.LLM_PROVIDER;
  else process.env.LLM_PROVIDER = originalLlmProvider;
  if (originalLlmModel === undefined) delete process.env.LLM_MODEL;
  else process.env.LLM_MODEL = originalLlmModel;
  if (originalOpenRouterKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalOpenRouterKey;
});

test("OpenRouter composition uses the configured DeepSeek model and JSON output", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_MODEL = "deepseek/deepseek-v4.1-flash";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  let requestBody: Record<string, unknown> | undefined;
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-openrouter-key");
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ timeline: [{ title: "Supported", body: "A sourced fact.", sourceIndex: 1, supportingExcerpt: "A sourced fact." }], narrative: [] }) } }] });
  };

  const composed = await composeWithOpenRouter(
    { place: "Tahlequah, Oklahoma", period: "1830s", interests: ["Cherokee music", "oral history"] },
    [{ title: "Source", url: "https://example.org/source", extract: "A sourced fact." }],
  );

  assert.equal(requestBody?.model, "deepseek/deepseek-v4.1-flash");
  assert.deepEqual(requestBody?.response_format, { type: "json_object" });
  assert.deepEqual(requestBody?.reasoning, { enabled: false });
  assert.equal(composed?.timeline[0]?.sourceUrl, "https://example.org/source");
});

test("OpenRouter can describe allowlisted media without changing its URL or license", async () => {
  process.env.LLM_PROVIDER = "openrouter";
  process.env.LLM_MODEL = "deepseek/deepseek-v4.1-flash";
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  globalThis.fetch = async () => Response.json({ choices: [{ message: { content: JSON.stringify({ descriptions: [{ id: "media:test", description: "A concise model-written description." }] }) } }] });
  const media = [{ id: "media:test", title: "Test recording", creator: "Test archive", description: "Fallback.", mediaType: "audio" as const, mediaUrl: "https://upload.wikimedia.org/test.ogg", sourceUrl: "https://commons.wikimedia.org/test", license: "CC0" }];

  const described = await describeMediaWithOpenRouter({ place: "Test place", period: "1900s", interests: ["music", "history"] }, media);

  assert.equal(described?.[0]?.description, "A concise model-written description.");
  assert.equal(described?.[0]?.mediaUrl, media[0].mediaUrl);
  assert.equal(described?.[0]?.sourceUrl, media[0].sourceUrl);
  assert.equal(described?.[0]?.license, "CC0");
});

test("personal context is accepted without collecting identifiers", () => {
  const parsed = parseJourneyInput({
    place: "Kampala, Uganda",
    period: "1980s",
    connection: "My parent grew up here, and I want to understand the music they heard.",
    interests: ["kadongo kamu", "oral history"],
  });
  assert.equal(parsed.connection, "My parent grew up here, and I want to understand the music they heard.");
  assert.throws(() => parseJourneyInput({ ...parsed, connection: "Last name is Example" }), /never infers ethnicity or genealogy/);
});

test("every judge sample resolves to a distinct sourced evidence packet", () => {
  for (const key of demoSampleOrder) {
    const sample = demoSamples[key];
    const result = baseDemoResult(sample.input);
    assert.equal(getDemoSample(sample.input.place), sample);
    assert.equal(result.location, sample.location);
    assert.equal(result.timeline.length, 3);
    assert.ok(result.timeline.every((item) => item.evidenceType === "SOURCE_BACKED_HISTORY" && item.sourceUrl?.startsWith("https://")));
    assert.ok(result.narrative.some((item) => item.evidenceType === "FAMILY_TESTIMONY" && item.sourceTitle?.includes("fictional sample")));
    assert.ok(result.media.length >= 1);
    assert.ok(result.media.every((item) => new URL(item.mediaUrl).hostname === "upload.wikimedia.org" && item.license && item.attributionVerifiedAt));
  }
});

test("historical retrieval uses the Wikimedia gateway and returns linked excerpts", async () => {
  let requestUrl: URL | undefined;
  globalThis.fetch = async (input) => {
    requestUrl = new URL(String(input));
    return Response.json({ pages: [{ key: "Tahlequah,_Oklahoma", title: "Tahlequah, Oklahoma", excerpt: '<span class="searchmatch">Tahlequah</span> became the Cherokee capital.' }] });
  };

  const sources = await retrieveHistoricalSources("Tahlequah, Oklahoma", "1830s");

  assert.equal(requestUrl?.origin, "https://api.wikimedia.org");
  assert.equal(requestUrl?.pathname, "/core/v1/wikipedia/en/search/page");
  assert.equal(requestUrl?.searchParams.get("q"), "Tahlequah, Oklahoma history 1830s");
  assert.equal(sources[0]?.url, "https://en.wikipedia.org/wiki/Tahlequah%2C_Oklahoma");
  assert.equal(sources[0]?.extract, "Tahlequah became the Cherokee capital.");
});

test("claim checker rejects unsupported history and preserves explicit evidence", () => {
  const checked = claimCheck([
    { id: "history:ok", title: "Sourced", body: "A documented fact happened in 1845.", supportingExcerpt: "Sourced. A documented fact happened in 1845.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://example.org/archive" },
    { id: "history:no-url", title: "Unsupported", body: "Claim", evidenceType: "SOURCE_BACKED_HISTORY" },
    { id: "testimony:1", title: "Memory", body: "User said this", evidenceType: "FAMILY_TESTIMONY" },
    { id: "not-qloo", title: "Fake affinity", body: "No entity", evidenceType: "QLOO_TASTE_CONNECTION" },
  ]);
  assert.deepEqual(checked.accepted.map((item) => item.id), ["history:ok", "testimony:1"]);
  assert.deepEqual(checked.rejected.map((item) => item.id), ["history:no-url", "not-qloo"]);
});

test("Qloo parser accepts documented and defensive response shapes", () => {
  assert.equal(extractEntities({ results: { entities: [{ entity_id: "a" }] } })[0].entity_id, "a");
  assert.equal(extractEntities({ results: [{ entity_id: "b" }] })[0].entity_id, "b");
  assert.equal(extractEntities({ data: { results: { entities: [{ entity_id: "c" }] } } })[0].entity_id, "c");
  assert.deepEqual(extractEntities({ success: true, results: { entities: [] } }), []);
});

test("Qloo tag parser and ambiguity gate reject an unresolved cultural concept", async () => {
  assert.equal(extractTags({ results: { tags: [{ tag_id: "tag-1" }] } })[0].tag_id, "tag-1");
  let requestUrl: URL | undefined;
  globalThis.fetch = async (input) => {
    requestUrl = new URL(String(input));
    return Response.json({ results: [
    { tag_id: "ireland", name: "Folk music of Ireland" },
    { tag_id: "italy", name: "Folk music of Italy" },
    ] });
  };
  assert.deepEqual(await resolveQlooInterests(["folk music"]), []);
  assert.equal(requestUrl?.pathname, "/v2/tags");
  assert.equal(requestUrl?.searchParams.get("filter.query"), "folk music");
  assert.equal(requestUrl?.searchParams.get("query"), null);
});

test("seeded named entities must match their expected Qloo type", async () => {
  globalThis.fetch = async () => Response.json({ results: [{ entity_id: "wrong", name: "Joy Harjo", subtype: "urn:entity:artist" }] });
  assert.deepEqual(await resolveQlooInterests(["Joy Harjo"]), []);
});

test("Qloo requests follow the hackathon authentication and URL contract", async () => {
  let requestUrl: URL | undefined;
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (input, init) => {
    requestUrl = new URL(String(input));
    requestInit = init;
    return Response.json({ results: [{ entity_id: "qloo-entity-id", name: "Native American flute" }] });
  };

  await resolveQlooInterests(["Afrigo Band"]);

  assert.equal(requestUrl?.origin, "https://hackathon.api.qloo.com");
  assert.equal(requestUrl?.pathname, "/search");
  assert.equal(requestUrl?.searchParams.get("query"), "Afrigo Band");
  assert.equal(requestUrl?.searchParams.get("types"), "urn:entity:artist");
  assert.equal(requestInit?.method, "GET");
  assert.equal(new Headers(requestInit?.headers).get("X-Api-Key"), "test-only-key");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), null);
});

test("Qloo Insights uses documented entity signals and explainability for every category", async () => {
  const requests: Array<{ url: URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({ url, init });
    const type = url.searchParams.get("filter.type") || "unknown";
    return Response.json({ results: { entities: [{ entity_id: `result-${type}`, name: `Result for ${type}` }] } });
  };

  const response = await getQlooDiscoveries([
    { id: "signal-one", name: "Cherokee music", type: "urn:entity:artist" },
    { id: "signal-two", name: "Native American flute", type: "urn:entity:artist" },
  ]);

  assert.equal(response.state.status, "live");
  assert.equal(requests.length, 4);
  assert.deepEqual(requests.map(({ url }) => url.searchParams.get("filter.type")), [
    "urn:entity:artist",
    "urn:entity:book",
    "urn:entity:movie",
    "urn:entity:destination",
  ]);
  for (const { url, init } of requests) {
    assert.equal(url.origin, "https://hackathon.api.qloo.com");
    assert.equal(url.pathname, "/v2/insights");
    assert.equal(url.searchParams.get("signal.interests.entities"), "signal-one,signal-two");
    assert.equal(url.searchParams.get("feature.explainability"), "true");
    assert.equal(url.searchParams.get("take"), "3");
    assert.equal(init?.method, "GET");
  }
});

test("Qloo Insights preserves successful categories when one category fails", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const type = url.searchParams.get("filter.type");
    if (type === "urn:entity:book") return new Response("temporary", { status: 503 });
    return Response.json({ results: { entities: [{ entity_id: `ok-${type}`, name: `Result ${type}` }] } });
  };
  const response = await getQlooDiscoveries([{ id: "verified", name: "Afrigo Band", type: "urn:entity:artist", signalKind: "entity", verified: true }]);
  assert.equal(response.discoveries.length, 3);
  assert.equal(response.state.status, "live");
  assert.match(response.state.message, /3 of 4/);
});

test("Qloo rejects a non-hackathon base URL before sending a credential", async () => {
  process.env.QLOO_BASE_URL = "https://api.qloo.com";
  globalThis.fetch = async () => { throw new Error("fetch must not run"); };
  await assert.rejects(
    () => resolveQlooInterests(["Native American flute"]),
    (error: unknown) => error instanceof QlooError && /hackathon keys require/.test(error.state.message),
  );
});

test("Qloo 401, 403, and 429 failures are explicit and do not fall back", async (t) => {
  await t.test("401", async () => {
    globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
    await assert.rejects(() => resolveQlooInterests(["unique unauthorized signal"]), (error: unknown) => error instanceof QlooError && error.state.status === "unauthorized");
  });
  await t.test("429", async () => {
    globalThis.fetch = async () => new Response("limited", { status: 429, headers: { "retry-after": "7" } });
    await assert.rejects(() => resolveQlooInterests(["unique rate limited signal"]), (error: unknown) => error instanceof QlooError && error.state.status === "rate_limited" && error.state.retryAfterSeconds === 7);
  });
  await t.test("403", async () => {
    globalThis.fetch = async () => new Response("forbidden", { status: 403 });
    await assert.rejects(() => resolveQlooInterests(["unique forbidden signal"]), (error: unknown) => error instanceof QlooError && error.state.status === "error" && /signal or entity type/.test(error.state.message));
  });
});

test("Qloo ignores search results without an entity ID", async () => {
  globalThis.fetch = async () => Response.json({ results: [{ name: "Unresolved result" }] });
  assert.deepEqual(await resolveQlooInterests(["unresolved interest"]), []);
});

test("taste swap keeps history stable while changing Qloo signals and discoveries", async () => {
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    if (url.pathname === "/search") {
      const name = url.searchParams.get("query") || "unknown";
      return Response.json({ results: [{ entity_id: `id-${name.replaceAll(" ", "-")}`, name, subtype: "urn:entity:artist" }] });
    }
    if (url.pathname === "/v2/tags") {
      const name = url.searchParams.get("filter.query") || "unknown";
      return Response.json({ results: [{ tag_id: `tag-${name.replaceAll(" ", "-")}`, name }] });
    }
    const signal = [url.searchParams.get("signal.interests.entities"), url.searchParams.get("signal.interests.tags")].filter(Boolean).join(",") || "none";
    const type = url.searchParams.get("filter.type") || "urn:entity:artist";
    return Response.json({ results: { entities: [{ entity_id: `result-${type}-${signal}`, name: `Result for ${signal}`, subtype: type, properties: { description: "Mocked Qloo result" } }] } });
  };

  const rhythm = await runHeritageAgent({ ...demoInput, interests: [...demoProfiles.rhythm], tasteProfile: "rhythm" });
  const page = await runHeritageAgent({ ...demoInput, interests: [...demoProfiles.page], tasteProfile: "page" });
  assert.deepEqual(rhythm.timeline, page.timeline);
  assert.notDeepEqual(rhythm.resolvedInterests.map((item) => item.id), page.resolvedInterests.map((item) => item.id));
  assert.notDeepEqual(rhythm.discoveries.map((item) => item.qlooEntityId), page.discoveries.map((item) => item.qlooEntityId));
  assert.equal(rhythm.qloo.status, "live");
  assert.equal(page.qloo.status, "live");
});
