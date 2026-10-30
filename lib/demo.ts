import type { EvidenceItem, JourneyInput, JourneyResult, MediaItem } from "./types";

export type DemoSampleKey = "nativeAmerican" | "irish" | "italian" | "africanAmerican";

type DemoSample = {
  label: string;
  match: string[];
  input: JourneyInput;
  profiles: { rhythm: readonly string[]; page: readonly string[] };
  location: JourneyResult["location"];
  timeline: EvidenceItem[];
  media: MediaItem[];
  memoryTitle: string;
  reconstruction: { id: string; title: string; body: string };
};

const nativeProfiles = {
  rhythm: ["Cherokee music", "Native American flute", "oral history"],
  page: ["Joy Harjo", "Indigenous literature", "documentary film"],
} as const;
const irishProfiles = {
  rhythm: ["Irish folk music", "Celtic music", "oral history"],
  page: ["Colm Tóibín", "Irish literature", "historical documentary"],
} as const;
const italianProfiles = {
  rhythm: ["Italian folk music", "Neapolitan song", "oral history"],
  page: ["Italian American literature", "immigrant memoir", "documentary film"],
} as const;
const africanAmericanProfiles = {
  rhythm: ["Duke Ellington", "Harlem jazz", "gospel music"],
  page: ["Langston Hughes", "Harlem Renaissance literature", "documentary film"],
} as const;

export const demoSamples: Record<DemoSampleKey, DemoSample> = {
  nativeAmerican: {
    label: "Native American",
    match: ["tahlequah"],
    profiles: nativeProfiles,
    input: {
      place: "Tahlequah, Cherokee Nation, Oklahoma",
      period: "1830s–1840s",
      connection: "My family lived near Tahlequah, and I want to understand the Cherokee history of the region without assuming ancestry.",
      memory: "Fictional sample memory: A grandmother recalled a community gathering near Tahlequah, where she heard Cherokee words spoken and kept a newspaper clipping about the town.",
      interests: [...nativeProfiles.rhythm], tasteProfile: "rhythm", demo: true,
    },
    location: { name: "Tahlequah", lat: 35.9154, lng: -94.9699 },
    timeline: [
      { id: "history:cherokee-1830", title: "The Indian Removal Act becomes law", body: "In 1830, the United States enacted the Indian Removal Act, intensifying federal pressure on Cherokee people and other southeastern Native nations to leave their homelands.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.nps.gov/trte/learn/historyculture/index.htm", sourceTitle: "U.S. National Park Service — Trail of Tears history", year: 1830 },
      { id: "history:cherokee-1838", title: "Cherokee people are forcibly removed", body: "Beginning in May 1838, U.S. troops and state militias forcibly removed more than 16,000 Cherokee people from homelands in the Southeast; the resulting Trail of Tears was devastating.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.nps.gov/trte/learn/historyculture/index.htm", sourceTitle: "U.S. National Park Service — Trail of Tears history", year: 1838 },
      { id: "history:cherokee-1839", title: "Tahlequah becomes the Cherokee capital", body: "In 1839, Cherokee people established Tahlequah as their capital and adopted a new constitution as the Cherokee Nation rebuilt its government in Indian Territory.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.okhistory.org/publications/enc/entry?entry=TA002", sourceTitle: "Oklahoma Historical Society — Tahlequah", year: 1839 },
    ],
    media: [
      { id: "media:cherokee-sovereignty", title: "Cherokee Nation and tribal sovereignty", creator: "Indianz.Com", creatorUrl: "https://www.youtube.com/@indianzcom", description: "A public video discussing Cherokee Nation sovereignty in a contemporary legal setting.", mediaType: "video", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/d/dc/%27In_defense_of_tribal_sovereignty%27-_Cherokee_Nation_at_U.S._Supreme_Court.webm", sourceUrl: "https://commons.wikimedia.org/wiki/File:%27In_defense_of_tribal_sovereignty%27-_Cherokee_Nation_at_U.S._Supreme_Court.webm", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", attributionVerifiedAt: "2026-10-29" },
    ],
    memoryTitle: "Words at a gathering",
    reconstruction: { id: "reconstruction:cherokee-gathering", title: "A possible gathering", body: "One can imagine conversation moving between English and Cherokee as families shared news near Tahlequah. This scene is an imaginative bridge, not a documented event in this family’s life or evidence of Cherokee ancestry." },
  },
  irish: {
    label: "Irish",
    match: ["five points", "irish new york"],
    profiles: irishProfiles,
    input: {
      place: "Five Points, New York City", period: "1840s–1860s",
      connection: "My family lived in New York, and I want to understand the Irish immigrant history of the neighborhood without assuming ancestry.",
      memory: "Fictional sample memory: A grandmother recalled a worn letter from Ireland and a tin-whistle tune played at a neighborhood gathering.",
      interests: [...irishProfiles.rhythm], tasteProfile: "rhythm", demo: true,
    },
    location: { name: "Five Points, New York City", lat: 40.7145, lng: -74.0019 },
    timeline: [
      { id: "history:irish-1845", title: "The potato blight accelerates migration", body: "Ireland’s potato blight began in 1845 and helped launch a major wave of Irish immigration to the United States as famine devastated families and communities.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/classroom-materials/immigration/irish/irish-catholic-immigration-to-america/", sourceTitle: "Library of Congress — Irish-Catholic Immigration to America", year: 1845 },
      { id: "history:irish-1850", title: "Irish families reshape American cities", body: "Within five years of the 1845 blight, roughly half a million Irish people had arrived in America; many settled in urban centers including New York and Boston.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/classroom-materials/immigration/irish/irish-catholic-immigration-to-america/", sourceTitle: "Library of Congress — Irish-Catholic Immigration to America", year: 1850 },
      { id: "history:irish-1861", title: "Irish Americans enter the Civil War", body: "When the Civil War began, Irish American units—including New York’s 69th Regiment—served in the Union Army while using Irish symbols to connect heritage with their new country.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/exhibits/civil-war-in-america/april-1861-april-1862.html", sourceTitle: "Library of Congress — The Civil War in America", year: 1861 },
    ],
    media: [
      { id: "media:irish-tin-whistle", title: "Báidín Fheidhlimidh on tin whistle", creator: "Jules Grandgagnage", creatorUrl: "https://commons.wikimedia.org/wiki/User:Jules_Grandgagnage", description: "A freely licensed performance of an Irish traditional song on tin whistle.", mediaType: "audio", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/7/71/Baidin_Feidhlimidh_tinwhistleD.ogg/Baidin_Feidhlimidh_tinwhistleD.ogg.mp3", sourceUrl: "https://commons.wikimedia.org/wiki/File:Baidin_Feidhlimidh_tinwhistleD.ogg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/", attributionVerifiedAt: "2026-10-29" },
      { id: "media:irish-barley", title: "The Wind That Shakes the Barley", creator: "peakfiddler", description: "A freely licensed recording of an Irish reel associated with the traditional music repertoire.", mediaType: "audio", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/e/ea/The_Wind_that_Shakes_the_Barley.ogg/The_Wind_that_Shakes_the_Barley.ogg.mp3", sourceUrl: "https://commons.wikimedia.org/wiki/File:The_Wind_that_Shakes_the_Barley.ogg", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", attributionVerifiedAt: "2026-10-29" },
    ],
    memoryTitle: "A letter and a tune",
    reconstruction: { id: "reconstruction:irish-gathering", title: "A possible evening", body: "One can imagine a letter being read aloud while a familiar tune crossed a crowded New York room. This scene is an imaginative bridge, not a documented event in this family’s life or evidence of Irish ancestry." },
  },
  italian: {
    label: "Italian",
    match: ["little italy", "italian new york"],
    profiles: italianProfiles,
    input: {
      place: "Little Italy, New York City", period: "1880s–1920s",
      connection: "My family lived in New York, and I want to understand the Italian immigrant history of the neighborhood without assuming ancestry.",
      memory: "Fictional sample memory: A grandfather recalled a handwritten address card and hearing Italian spoken around neighborhood shops.",
      interests: [...italianProfiles.rhythm], tasteProfile: "rhythm", demo: true,
    },
    location: { name: "Little Italy, New York City", lat: 40.7191, lng: -73.9973 },
    timeline: [
      { id: "history:italian-1880", title: "Italian immigration grows rapidly", body: "About 300,000 Italian immigrants arrived in the United States during the 1880s as poverty, upheaval, and expanding transatlantic travel shaped migration decisions.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/classroom-materials/immigration/italian/the-great-arrival/", sourceTitle: "Library of Congress — The Great Arrival", year: 1880 },
      { id: "history:italian-1900", title: "More than two million arrive in a decade", body: "In the first decade of the twentieth century, more than two million Italian immigrants arrived in the United States, many entering through Ellis Island and seeking steady work.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/classroom-materials/immigration/italian/the-great-arrival/", sourceTitle: "Library of Congress — The Great Arrival", year: 1900 },
      { id: "history:italian-1920", title: "Italian American communities take root", body: "By 1920, more than four million Italians had come to the United States, representing more than ten percent of the nation’s foreign-born population.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://www.loc.gov/classroom-materials/immigration/italian/the-great-arrival/", sourceTitle: "Library of Congress — The Great Arrival", year: 1920 },
    ],
    media: [
      { id: "media:italian-bella-ciao", title: "Bella ciao — instrumental", creator: "Pracchia-78", description: "A public-domain instrumental rendering of the Italian folk song Bella ciao.", mediaType: "audio", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/02/Anonimo_-_Bella_ciao_%28versione_solo_strumentale%29.ogg/Anonimo_-_Bella_ciao_%28versione_solo_strumentale%29.ogg.mp3", sourceUrl: "https://commons.wikimedia.org/wiki/File:Anonimo_-_Bella_ciao_(versione_solo_strumentale).ogg", license: "Public domain", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", attributionVerifiedAt: "2026-10-29" },
      { id: "media:italian-immigration-film", title: "Immigrant to America", creator: "U.S. National Archives and Records Administration", creatorUrl: "https://www.archives.gov/", description: "A freely reusable archival film about immigration to America, presented as broad visual context rather than evidence about a specific family.", mediaType: "video", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/0/09/Immigrant_to_America.ogv/Immigrant_to_America.ogv.240p.vp9.webm", sourceUrl: "https://commons.wikimedia.org/wiki/File:Immigrant_to_America.ogv", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", attributionVerifiedAt: "2026-10-29" },
    ],
    memoryTitle: "An address card",
    reconstruction: { id: "reconstruction:italian-street", title: "A possible street scene", body: "One can imagine addresses being compared and news from Italy exchanged outside neighborhood shops. This scene is an imaginative bridge, not a documented event in this family’s life or evidence of Italian ancestry." },
  },
  africanAmerican: {
    label: "African American",
    match: ["harlem"],
    profiles: africanAmericanProfiles,
    input: {
      place: "Harlem, New York City", period: "1910s–1930s",
      connection: "My family lived in New York, and I want to understand African American life in Harlem during the Great Migration and Harlem Renaissance.",
      memory: "Fictional sample memory: A relative recalled saving a church program and hearing jazz drift from an apartment window on a summer evening.",
      interests: [...africanAmericanProfiles.rhythm], tasteProfile: "rhythm", demo: true,
    },
    location: { name: "Harlem, New York City", lat: 40.8116, lng: -73.9465 },
    timeline: [
      { id: "history:harlem-1910", title: "The Great Migration reshapes Harlem", body: "In the early twentieth century, African Americans moved north to escape the Jim Crow South; many settled in Harlem as subway access expanded uptown.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://home.nps.gov/articles/000/harlem.htm", sourceTitle: "U.S. National Park Service — Harlem", year: 1910 },
      { id: "history:harlem-1920", title: "The Harlem Renaissance flourishes", body: "Between the World Wars, Harlem became a major center of African American literature, music, visual art, intellectual life, and political expression.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://home.nps.gov/articles/000/harlem.htm", sourceTitle: "U.S. National Park Service — Harlem", year: 1920 },
      { id: "history:harlem-1930", title: "Harlem’s population transforms", body: "By 1930, Harlem was approximately 70 percent African American, compared with about 10 percent in 1910.", evidenceType: "SOURCE_BACKED_HISTORY", sourceUrl: "https://home.nps.gov/articles/000/harlem.htm", sourceTitle: "U.S. National Park Service — Harlem", year: 1930 },
    ],
    media: [
      { id: "media:harlem-artists-film", title: "Study of Black artists — archival film", creator: "Unknown author; public-domain archival film", description: "A public-domain archival film about Black artists, retained under a respectful display title while the source preserves its historical catalog title.", mediaType: "video", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/5/53/Study_of_negro_artists.ogv/Study_of_negro_artists.ogv.240p.vp9.webm", sourceUrl: "https://commons.wikimedia.org/wiki/File:Study_of_negro_artists.ogv", license: "Public domain", licenseUrl: "https://creativecommons.org/publicdomain/mark/1.0/", attributionVerifiedAt: "2026-10-29" },
      { id: "media:jazz-vocal-performance", title: "Jazz vocal performance", creator: "BBC (performance by Cleveland Watkiss)", creatorUrl: "https://www.bbc.co.uk/programmes/b01s09z5", description: "A freely licensed jazz vocal performance that offers a contemporary doorway into the wider musical tradition celebrated by the Harlem sample.", mediaType: "audio", mediaUrl: "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/33/Cleveland_Watkiss_in_Ella_in_Berlin_b01s09z5.flac/Cleveland_Watkiss_in_Ella_in_Berlin_b01s09z5.flac.mp3", sourceUrl: "https://commons.wikimedia.org/wiki/File:Cleveland_Watkiss_in_Ella_in_Berlin_b01s09z5.flac", license: "CC BY 3.0", licenseUrl: "https://creativecommons.org/licenses/by/3.0/", attributionVerifiedAt: "2026-10-29" },
    ],
    memoryTitle: "A program and an open window",
    reconstruction: { id: "reconstruction:harlem-evening", title: "A possible Harlem evening", body: "One can imagine churchgoers, writers, workers, and musicians sharing the same blocks as music carried through open windows. This scene is an imaginative bridge, not a documented event in this family’s life." },
  },
};

export const demoSampleOrder: DemoSampleKey[] = ["nativeAmerican", "irish", "italian", "africanAmerican"];
export const demoInput = demoSamples.nativeAmerican.input;
export const demoProfiles = demoSamples.nativeAmerican.profiles;

export function getDemoSample(place: string) {
  const normalized = place.toLowerCase();
  return Object.values(demoSamples).find((sample) => sample.match.some((term) => normalized.includes(term)));
}

export function isDemoPlace(place: string) {
  return Boolean(getDemoSample(place));
}

export function baseDemoResult(input: JourneyInput): JourneyResult {
  const sample = getDemoSample(input.place) || demoSamples.nativeAmerican;
  return {
    input,
    location: sample.location,
    timeline: sample.timeline.map((item) => ({ ...item, supportingExcerpt: `${item.title}. ${item.body}` })),
    narrative: [
      ...(input.connection ? [{ id: "testimony:connection", title: "Why this place matters to you", body: input.connection, evidenceType: "FAMILY_TESTIMONY" as const, sourceTitle: "User-provided context" }] : []),
      { id: `testimony:sample-${sample.location.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`, title: sample.memoryTitle, body: input.memory || "No family memory was supplied.", evidenceType: "FAMILY_TESTIMONY", sourceTitle: "User-provided memory (fictional sample, not a historical source)" },
      { ...sample.reconstruction, evidenceType: "CREATIVE_RECONSTRUCTION" },
    ],
    discoveries: [], culturalRoute: null, media: sample.media, resolvedInterests: [],
    qloo: { status: "unconfigured", message: "Qloo is not configured on this deployment. No recommendations have been substituted or invented." },
    agentTrace: [], generatedAt: new Date().toISOString(),
  };
}
