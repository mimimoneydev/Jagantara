import type { JourneyInput } from "./types";

const forbiddenSurnamePattern = /(?:surname|last\s+name)\s*(?:is|:)\s*[^,.;]+/i;

export function parseJourneyInput(value: unknown): JourneyInput {
  if (!value || typeof value !== "object") throw new Error("Journey input is required.");
  const raw = value as Record<string, unknown>;
  const place = clean(raw.place, 100);
  const period = clean(raw.period, 60);
  const connection = clean(raw.connection, 180, true);
  const memory = clean(raw.memory, 600, true);
  const interests = Array.isArray(raw.interests)
    ? raw.interests.map((item) => clean(item, 80)).filter(Boolean).slice(0, 3)
    : [];

  if (!place) throw new Error("Add a family place.");
  if (!period) throw new Error("Add an approximate period.");
  if (interests.length < 2) throw new Error("Choose at least two cultural interests.");
  if (forbiddenSurnamePattern.test(place) || forbiddenSurnamePattern.test(connection) || forbiddenSurnamePattern.test(memory)) {
    throw new Error("Use a place, not a surname. Jagantara never infers ethnicity or genealogy from names.");
  }

  const tasteProfile = raw.tasteProfile === "page" || raw.tasteProfile === "custom" ? raw.tasteProfile : "rhythm";
  return { place, period, connection: connection || undefined, memory: memory || undefined, interests, tasteProfile, demo: raw.demo === true };
}

function clean(value: unknown, max: number, optional = false) {
  if (typeof value !== "string") return optional ? "" : "";
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}
