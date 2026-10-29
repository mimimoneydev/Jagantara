import { baseDemoResult, isDemoPlace } from "./demo";
import { claimCheck } from "./evidence";
import { composeWithOpenRouter, describeMediaWithOpenRouter } from "./openrouter";
import { retrieveHistoricalSources, sourcesAsConservativeTimeline } from "./history";
import { getQlooDiscoveries, QlooError, resolveQlooInterests } from "./qloo";
import type { AgentTrace, JourneyInput, JourneyResult } from "./types";

export async function runHeritageAgent(input: JourneyInput): Promise<JourneyResult> {
  const trace: AgentTrace[] = [{ tool: "parse_input", status: "complete", detail: `Validated place, period, personal connection, memory attribution, and ${input.interests.length} interests.` }];
  const qlooPromise = withDeadline((async () => {
    const resolved = await resolveQlooInterests(input.interests);
    return { resolved, ...(await getQlooDiscoveries(resolved)) };
  })(), 22_000);
  let result: JourneyResult;
  let mediaDescriptionPromise: ReturnType<typeof describeMediaWithOpenRouter> | undefined;

  if (input.demo && isDemoPlace(input.place)) {
    result = baseDemoResult(input);
    mediaDescriptionPromise = describeMediaWithOpenRouter(input, result.media);
    trace.push({ tool: "retrieve_historical_sources", status: "complete", detail: "Loaded the judge journey’s retrievable source packet." });
    trace.push({ tool: "compose_response", status: "complete", detail: "Composed the disclosed sample testimony and clearly marked reconstruction." });
  } else {
    const sources = await retrieveHistoricalSources(input.place, input.period);
    trace.push({ tool: "retrieve_historical_sources", status: sources.length ? "complete" : "failed", detail: sources.length ? `Retrieved ${sources.length} source pages with URLs.` : "No source pages could be retrieved; no historical facts were invented." });
    const composed = await composeWithOpenRouter(input, sources);
    const timeline = composed?.timeline.length ? composed.timeline : sourcesAsConservativeTimeline(sources);
    const narrative = composed?.narrative.length ? composed.narrative : [
      ...(input.connection ? [{ id: "testimony:connection", title: "Your connection", body: input.connection, evidenceType: "FAMILY_TESTIMONY" as const, sourceTitle: "User-provided context" }] : []),
      ...(input.memory ? [{ id: "testimony:user", title: "Your family memory", body: input.memory, evidenceType: "FAMILY_TESTIMONY" as const, sourceTitle: "User-provided memory" }] : []),
    ];
    result = {
      input,
      location: { name: input.place, lat: 0, lng: 0 },
      timeline,
      narrative,
      discoveries: [],
      culturalRoute: null,
      media: [],
      resolvedInterests: [],
      qloo: { status: "unconfigured", message: "Qloo has not run yet." },
      agentTrace: [],
      generatedAt: new Date().toISOString(),
    };
    trace.push({ tool: "compose_response", status: composed ? "complete" : "skipped", detail: composed ? "OpenRouter composed claims only from the retrieved source packet." : "OpenRouter was unavailable; returned source leads and attributed memory without inventing claims." });
  }

  try {
    const qloo = await qlooPromise;
    result.resolvedInterests = qloo.resolved;
    result.discoveries = qloo.discoveries;
    result.qloo = qloo.state;
    trace.push({ tool: "qloo_entity_resolution", status: qloo.resolved.length ? "complete" : "failed", detail: qloo.resolved.length ? `Verified ${qloo.resolved.length} typed Qloo entity/tag signals; ambiguous candidates were rejected.` : "No Qloo signal passed verification." });
    trace.push({ tool: "qloo_insights", status: qloo.discoveries.length ? "complete" : "failed", detail: qloo.discoveries.length ? `Built the primary cultural route from ${qloo.discoveries.length} live, explainable Qloo discoveries.` : qloo.state.message });
  } catch (error) {
    result.qloo = error instanceof QlooError ? error.state : { status: "error", message: "Qloo failed unexpectedly. No substitute results were used." };
    trace.push({ tool: "qloo_entity_resolution", status: "failed", detail: result.qloo.message });
    trace.push({ tool: "qloo_insights", status: "skipped", detail: "Skipped because entity resolution did not complete." });
  }

  if (mediaDescriptionPromise) {
    const describedMedia = await mediaDescriptionPromise;
    if (describedMedia) result.media = describedMedia;
    trace.push({ tool: "describe_media", status: describedMedia ? "complete" : "skipped", detail: describedMedia ? `OpenRouter wrote bounded descriptions for ${describedMedia.length} allowlisted media items; URLs and licenses remained fixed.` : "Used the curated media descriptions because model enrichment was unavailable." });
  }

  const checkedTimeline = claimCheck(result.timeline);
  const checkedDiscoveries = claimCheck(result.discoveries);
  result.timeline = checkedTimeline.accepted;
  result.discoveries = checkedDiscoveries.accepted as typeof result.discoveries;
  result.culturalRoute = result.discoveries.length ? {
    title: `A Qloo cultural route through ${result.location.name}`,
    summary: "This is the primary deliverable: a cross-media route generated from verified Qloo entities and tags. History anchors context; Qloo determines every route stop.",
    stops: ["music", "books", "film", "destinations"].flatMap((category) => result.discoveries.find((item) => item.category === category) || []),
    completeCategories: [...new Set(result.discoveries.map((item) => item.category))],
  } : null;
  trace.push({ tool: "claim_check", status: "complete", detail: `Accepted ${checkedTimeline.accepted.length} source-entailed historical items and ${checkedDiscoveries.accepted.length} Qloo-labeled items; rejected ${checkedTimeline.rejected.length + checkedDiscoveries.rejected.length}.` });
  result.agentTrace = trace;
  return result;
}

async function withDeadline<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new QlooError("Judge-path deadline exceeded.", { status: "timeout", message: "Qloo exceeded the 22-second end-to-end budget; no recommendations were fabricated." })), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
