import type { Discovery, MediaItem } from "./types";

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const FREE_LICENSE = /^(?:CC BY(?:-SA)?(?: \d\.\d)?|CC0|Public domain|Public Domain|PDM)/i;

type CommonsPage = {
  pageid?: number;
  title?: string;
  index?: number;
  imageinfo?: Array<{
    url?: string;
    mime?: string;
    mediatype?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

/** Find playable, freely licensed Commons media using live Qloo discovery titles. */
export async function findPublicMediaForDiscoveries(discoveries: Discovery[], limit = 4): Promise<MediaItem[]> {
  const candidates = [
    ...discoveries.filter((item) => item.category === "music").slice(0, 3),
    ...discoveries.filter((item) => item.category === "film").slice(0, 3),
  ];
  const settled = await Promise.allSettled(candidates.map(searchPublicMedia));
  const media = settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
  return [...new Map(media.map((item) => [item.mediaUrl, item])).values()].slice(0, limit);
}

async function searchPublicMedia(discovery: Discovery) {
  return await searchInternetArchive(discovery) || await searchCommons(discovery);
}

async function searchInternetArchive(discovery: Discovery): Promise<MediaItem | null> {
  const wantedType = discovery.category === "music" ? "audio" : "movies";
  const endpoint = new URL("https://archive.org/advancedsearch.php");
  const escapedTitle = discovery.title.replace(/["\\]/g, " ").trim();
  endpoint.searchParams.set("q", `(title:"${escapedTitle}" OR creator:"${escapedTitle}") AND mediatype:${wantedType} AND licenseurl:*`);
  endpoint.searchParams.append("fl[]", "identifier");
  endpoint.searchParams.append("fl[]", "title");
  endpoint.searchParams.append("fl[]", "creator");
  endpoint.searchParams.append("fl[]", "licenseurl");
  endpoint.searchParams.append("fl[]", "description");
  endpoint.searchParams.append("fl[]", "mediatype");
  endpoint.searchParams.set("rows", "5");
  endpoint.searchParams.set("output", "json");
  const search = await publicFetch(endpoint);
  if (!search?.ok) return null;
  const payload = await search.json() as { response?: { docs?: Array<Record<string, unknown>> } };
  const docs = payload.response?.docs || [];
  const doc = docs.find((item) => {
    const licenseUrl = text(item.licenseurl);
    return licenseLabel(licenseUrl) && discoveryMatch(discovery, text(item.title), `${text(item.title)} ${text(item.creator)} ${text(item.description)}`);
  });
  if (!doc) return null;
  const identifier = text(doc.identifier);
  if (!identifier) return null;
  const metadataResponse = await publicFetch(new URL(`https://archive.org/metadata/${encodeURIComponent(identifier)}`));
  if (!metadataResponse?.ok) return null;
  const metadata = await metadataResponse.json() as { metadata?: Record<string, unknown>; files?: Array<Record<string, unknown>> };
  const files = (metadata.files || []).filter((file) => playableArchiveFile(text(file.name), discovery.category) && Number(file.size || 0) >= 500_000 && Number(file.size || 0) <= 120_000_000);
  const file = files.sort((a, b) => archiveFileRank(a, discovery.category) - archiveFileRank(b, discovery.category))[0];
  const filename = text(file?.name);
  if (!filename) return null;
  const licenseUrl = safeUrl(text(doc.licenseurl) || text(metadata.metadata?.licenseurl));
  const license = licenseLabel(licenseUrl);
  const creator = plain(text(doc.creator) || text(metadata.metadata?.creator));
  if (!license || !creator) return null;
  const mediaType = discovery.category === "music" ? "audio" : "video";
  return {
    id: `media:qloo:${discovery.qlooEntityId}:ia:${identifier}`,
    title: plain(text(doc.title) || text(metadata.metadata?.title) || discovery.title),
    creator,
    description: plain(text(doc.description) || text(metadata.metadata?.description)).slice(0, 320) || `Public ${mediaType} found from the Qloo discovery “${discovery.title}”.`,
    mediaType,
    mediaUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(filename)}`,
    sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    license,
    licenseUrl,
    attributionVerifiedAt: new Date().toISOString().slice(0, 10),
    relatedQlooEntityId: discovery.qlooEntityId,
    relatedDiscoveryTitle: discovery.title,
  };
}

async function searchCommons(discovery: Discovery): Promise<MediaItem | null> {
  const wantedType = discovery.category === "music" ? "audio" : "video";
  const endpoint = new URL(COMMONS_API);
  const params = {
    action: "query",
    generator: "search",
    gsrsearch: `filetype:${wantedType} ${discovery.title}`,
    gsrnamespace: "6",
    gsrlimit: "12",
    prop: "imageinfo",
    iiprop: "url|mime|mediatype|extmetadata",
    format: "json",
    origin: "*",
  };
  Object.entries(params).forEach(([key, value]) => endpoint.searchParams.set(key, value));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(endpoint, { signal: controller.signal, headers: publicHeaders() });
    if (!response.ok) return null;
    const payload = await response.json() as { query?: { pages?: Record<string, CommonsPage> } };
    const pages = Object.values(payload.query?.pages || {}).sort((a, b) => (a.index || 999) - (b.index || 999));
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const metadata = info?.extmetadata || {};
      const mediaType = info?.mediatype === "AUDIO" ? "audio" : info?.mediatype === "VIDEO" ? "video" : null;
      const license = plain(metadata.LicenseShortName?.value);
      const creator = plain(metadata.Artist?.value);
      const description = plain(metadata.ImageDescription?.value);
      if (!info?.url || !mediaType || mediaType !== wantedType || !FREE_LICENSE.test(license) || !creator || !discoveryMatch(discovery, page.title || "", `${page.title || ""} ${description}`)) continue;
      const title = cleanTitle(page.title || discovery.title);
      return {
        id: `media:qloo:${discovery.qlooEntityId}:${page.pageid || title}`,
        title,
        creator,
        creatorUrl: firstLink(metadata.Artist?.value),
        description: description.slice(0, 320) || `Public ${mediaType} found from the Qloo discovery “${discovery.title}”.`,
        mediaType,
        mediaUrl: info.url,
        sourceUrl: commonsPageUrl(page.title || title),
        license,
        licenseUrl: safeUrl(metadata.LicenseUrl?.value),
        attributionVerifiedAt: new Date().toISOString().slice(0, 10),
        relatedQlooEntityId: discovery.qlooEntityId,
        relatedDiscoveryTitle: discovery.title,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function publicFetch(url: URL) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try { return await fetch(url, { signal: controller.signal, headers: publicHeaders() }); } catch { return null; } finally { clearTimeout(timer); }
}
function publicHeaders() { return { "User-Agent": "Jagantara/1.0 (Qloo-linked public media)", "Api-User-Agent": "Jagantara/1.0 (Qloo-linked public media)" }; }
function playableArchiveFile(name: string, category: Discovery["category"]) {
  return category === "music" ? /\.(?:mp3|ogg|oga|flac)$/i.test(name) : /\.(?:webm|ogv|mp4)$/i.test(name);
}
function archiveFileRank(file: Record<string, unknown>, category: Discovery["category"]) {
  const name = text(file.name);
  if (category === "music") return /\.mp3$/i.test(name) ? 0 : /\.ogg$/i.test(name) ? 1 : 2;
  return /\.webm$/i.test(name) ? 0 : /\.mp4$/i.test(name) ? 1 : 2;
}
function licenseLabel(url?: string) {
  if (!url) return "";
  if (/publicdomain\/(?:mark|zero)|\/zero\//i.test(url)) return /zero/i.test(url) ? "CC0" : "Public domain";
  const match = url.match(/licenses\/(by(?:-sa)?)\/(\d\.\d)/i);
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : "";
}
function relevant(query: string, candidate: string) {
  const queryTokens = tokens(query);
  const candidateTokens = new Set(tokens(candidate));
  return Boolean(queryTokens.length && queryTokens.filter((token) => candidateTokens.has(token)).length / queryTokens.length >= .75);
}
function discoveryMatch(discovery: Discovery, candidateTitle: string, candidateContext: string) {
  if (!relevant(discovery.title, candidateTitle)) return false;
  if (discovery.category !== "film") return true;
  const years = discovery.body.match(/\b(?:19|20)\d{2}\b/g) || [];
  return !years.length || years.some((year) => candidateTitle.includes(year) && candidateContext.includes(year));
}
function tokens(value: string) { return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((token) => token.length > 2 && !["the", "and", "for", "with"].includes(token)); }
function text(value: unknown): string { return Array.isArray(value) ? text(value[0]) : typeof value === "string" ? value : ""; }

function cleanTitle(value: string) {
  return value.replace(/^File:/i, "").replace(/\.(?:ogg|oga|ogv|webm|mp3|wav|flac)$/i, "").replaceAll("_", " ");
}
function plain(value?: string) {
  return (value || "").replace(/<[^>]*>/g, " ").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#039;", "'").replace(/\s+/g, " ").trim();
}
function firstLink(value?: string) {
  const href = value?.match(/href=["']([^"']+)/i)?.[1];
  if (!href) return undefined;
  if (href.startsWith("//")) return `https:${href}`;
  return safeUrl(href);
}
function safeUrl(value?: string) {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; } catch { return undefined; }
}
function commonsPageUrl(title: string) {
  return `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_")).replace("%3A", ":")}`;
}
