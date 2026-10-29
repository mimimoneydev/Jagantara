export const evidenceTypes = [
  "SOURCE_BACKED_HISTORY",
  "FAMILY_TESTIMONY",
  "QLOO_TASTE_CONNECTION",
  "CREATIVE_RECONSTRUCTION",
] as const;

export type EvidenceType = (typeof evidenceTypes)[number];

export type EvidenceItem = {
  id: string;
  title: string;
  body: string;
  evidenceType: EvidenceType;
  sourceUrl?: string;
  sourceTitle?: string;
  year?: number;
  /** The bounded source passage used to validate this claim. */
  supportingExcerpt?: string;
  entailment?: {
    status: "verified" | "rejected";
    score: number;
    method: "verbatim-source-overlap-v1";
  };
};

export type JourneyInput = {
  place: string;
  period: string;
  connection?: string;
  memory?: string;
  interests: string[];
  tasteProfile?: "rhythm" | "page" | "custom";
  demo?: boolean;
};

export type QlooEntity = {
  id: string;
  name: string;
  type: string;
  query?: string;
  signalKind?: "entity" | "tag";
  confidence?: number;
  verified?: boolean;
};

export type Discovery = EvidenceItem & {
  category: "music" | "books" | "film" | "destinations";
  qlooEntityId: string;
  imageUrl?: string;
  explanation: string[];
  affinity?: number;
};

export type MediaItem = {
  id: string;
  title: string;
  creator: string;
  description: string;
  mediaType: "audio" | "video";
  mediaUrl: string;
  sourceUrl: string;
  license: string;
  creatorUrl?: string;
  licenseUrl?: string;
  attributionVerifiedAt?: string;
};

export type CulturalRoute = {
  title: string;
  summary: string;
  stops: Discovery[];
  completeCategories: Discovery["category"][];
};

export type ServiceState = {
  status: "live" | "unconfigured" | "empty" | "unauthorized" | "rate_limited" | "timeout" | "error";
  message: string;
  retryAfterSeconds?: number;
};

export type AgentTrace = {
  tool: string;
  status: "complete" | "skipped" | "failed";
  detail: string;
};

export type JourneyResult = {
  input: JourneyInput;
  location: { name: string; lat: number; lng: number };
  timeline: EvidenceItem[];
  narrative: EvidenceItem[];
  discoveries: Discovery[];
  culturalRoute: CulturalRoute | null;
  media: MediaItem[];
  resolvedInterests: QlooEntity[];
  qloo: ServiceState;
  agentTrace: AgentTrace[];
  generatedAt: string;
};
