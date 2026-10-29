import { baseDemoResult, isDemoPlace } from "./demo";
import { claimCheck } from "./evidence";
import { composeWithOpenRouter, describeMediaWithOpenRouter } from "./openrouter";
import { retrieveHistoricalSources, sourcesAsConservativeTimeline } from "./history";
import { getQlooDiscoveries, QlooError, resolveQlooInterests } from "./qloo";
import type { AgentTrace, JourneyInput, JourneyResult } from "./types";

export async function runHeritageAgent(input: JourneyInput): Promise<JourneyResult> {
  const trace: AgentTrace[] = [{ tool: "parse_input", status: "complete", detail: `Validated place, period, personal connection, memory attribution, and ${input.interests.length} interests.` }];
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
      media: [],
      resolvedInterests: [],
      qloo: { status: "unconfigured", message: "Qloo has not run yet." },
      agentTrace: [],
      generatedAt: new Date().toISOString(),
    };
    trace.push({ tool: "compose_response", status: composed ? "complete" : "skipped", detail: composed ? "OpenRouter composed claims only from the retrieved source packet." : "OpenRouter was unavailable; returned source leads and attributed memory without inventing claims." });
  }

  try {
    const resolved = await resolveQlooInterests(input.interests);
    result.resolvedInterests = resolved;
    trace.push({ tool: "qloo_entity_resolution", status: resolved.length ? "complete" : "failed", detail: resolved.length ? `Saved ${resolved.length} Qloo entity IDs.` : "Qloo found no matching entities." });
    const qloo = await getQlooDiscoveries(resolved);
    result.discoveries = qloo.discoveries;
    result.qloo = qloo.state;
    trace.push({ tool: "qloo_insights", status: qloo.discoveries.length ? "complete" : "failed", detail: qloo.discoveries.length ? `Received ${qloo.discoveries.length} live discoveries across four categories with explainability requested.` : qloo.state.message });
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
  trace.push({ tool: "claim_check", status: "complete", detail: `Accepted ${checkedTimeline.accepted.length} sourced historical items and ${checkedDiscoveries.accepted.length} Qloo-labeled items; rejected ${checkedTimeline.rejected.length + checkedDiscoveries.rejected.length}.` });
  result.agentTrace = trace;
  return result;
}
