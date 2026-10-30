"use client";

import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronRight, CircleAlert, Compass, ExternalLink, Film, Headphones, Info, LoaderCircle, LockKeyhole, MapPin, Route, Sparkles, UserRound } from "lucide-react";
import { demoInput, demoSampleOrder, demoSamples, getDemoSample, isDemoPlace, type DemoSampleKey } from "@/lib/demo";
import type { Discovery, EvidenceType, JourneyInput, JourneyResult } from "@/lib/types";

const evidenceMeta: Record<EvidenceType, { label: string; className: string }> = {
  SOURCE_BACKED_HISTORY: { label: "Source-backed history", className: "evidence-history" },
  FAMILY_TESTIMONY: { label: "Family testimony", className: "evidence-memory" },
  QLOO_TASTE_CONNECTION: { label: "Qloo taste connection", className: "evidence-qloo" },
  CREATIVE_RECONSTRUCTION: { label: "Creative reconstruction", className: "evidence-reconstruction" },
};

const categoryIcon = { music: Headphones, books: BookOpen, film: Film, destinations: Compass };

export function AtlasApp({ initialResult }: { initialResult: JourneyResult }) {
  const [result, setResult] = useState(initialResult);
  const [form, setForm] = useState<JourneyInput>(demoInput);
  const [interestText, setInterestText] = useState(demoInput.interests.join(", "));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Discovery | null>(null);
  const [activeTimeline, setActiveTimeline] = useState(1);

  const profile = result.input.tasteProfile || "rhythm";
  const activeFact = result.timeline[activeTimeline] || result.timeline[0];
  const grouped = useMemo(() => result.discoveries.reduce<Partial<Record<Discovery["category"], Discovery[]>>>((groups, item) => {
    (groups[item.category] ||= []).push(item);
    return groups;
  }, {}), [result.discoveries]);

  async function runJourney(next: JourneyInput) {
    setLoading(true);
    setError("");
    setSelected(null);
    try {
      const response = await fetch("/api/journey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
      const data = await response.json() as JourneyResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "The journey could not be built.");
      setResult(data);
      setActiveTimeline(Math.min(1, Math.max(0, data.timeline.length - 1)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The journey could not be built.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next = { ...form, interests: interestText.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3), tasteProfile: "custom" as const, demo: isDemoPlace(form.place) };
    setForm(next);
    void runJourney(next);
  }

  function startMyStory() {
    setForm({ place: "", period: "", connection: "", memory: "", interests: [], tasteProfile: "custom", demo: false });
    setInterestText("");
    window.setTimeout(() => document.querySelector<HTMLInputElement>("#family-place")?.focus(), 450);
    document.querySelector("#build")?.scrollIntoView({ behavior: "smooth" });
  }

  function selectSample(key: DemoSampleKey) {
    const sample = demoSamples[key];
    const next = { ...sample.input, interests: [...sample.profiles.rhythm], tasteProfile: "rhythm" as const };
    setForm(next);
    setInterestText(next.interests.join(", "));
    void runJourney(next);
    document.querySelector("#journey")?.scrollIntoView({ behavior: "smooth" });
  }

  function swapTaste(nextProfile: "rhythm" | "page") {
    const sample = getDemoSample(result.input.place);
    const interests = sample
      ? [...sample.profiles[nextProfile]]
      : nextProfile === "rhythm"
        ? [...result.input.interests.slice(0, 2), "music traditions"].slice(0, 3)
        : [...result.input.interests.slice(0, 1), "literature", "documentary film"].slice(0, 3);
    const next = { ...result.input, interests, tasteProfile: nextProfile, demo: Boolean(sample) };
    setForm(next);
    setInterestText(next.interests.join(", "));
    void runJourney(next);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Jagantara home"><span className="brand-mark"><Route size={17} /></span><span>JAGANTARA</span></a>
        <nav aria-label="Main navigation"><a href="#journey">Journey</a><a href="#evidence">Evidence key</a><a href="#how">Method</a></nav>
        <button className="header-cta" onClick={startMyStory}>Create a journey <ArrowRight size={15} /></button>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Evidence-aware cultural discovery</p>
          <h1>History holds the route.<br/><em>Taste opens the doors.</em></h1>
          <p className="hero-lede">Trace a family place through sourced history, attributed memory, and live cultural connections—without turning affinity into ancestry.</p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={startMyStory}>Tell us about yourself <ChevronRight size={17} /></button>
            <div className="sample-actions" aria-label="Sample journeys">
              {demoSampleOrder.map((key) => {
                const sample = demoSamples[key];
                const active = getDemoSample(result.input.place) === sample;
                return <button key={key} className={`text-btn${active ? " active" : ""}`} aria-pressed={active} onClick={() => selectSample(key)} disabled={loading}>{sample.label} Sample</button>;
              })}
            </div>
          </div>
          <div className="trust-line"><span><Check size={13}/> Facts keep their sources</span><span><Check size={13}/> Memories stay attributed</span><span><Check size={13}/> Taste never rewrites history</span></div>
        </div>
        <AtlasMap location={result.location} />
      </section>

      <section className="workspace" id="journey">
        <aside className="builder" id="build">
          <div className="builder-intro">
            <span className="profile-icon"><UserRound size={17}/></span>
            <div><div className="section-kicker">01 / About you</div><h2>Tell us what brings you here.</h2></div>
          </div>
          <p>Share only what feels comfortable. Approximate details are welcome, and you never need to enter your name.</p>
          <div className="privacy-note"><LockKeyhole size={15}/><span>Your context shapes the route. It is treated as testimony, never proof of ancestry.</span></div>
          <form onSubmit={submit}>
            <label>Family place <span>required</span><input id="family-place" required value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="e.g. Tahlequah, Oklahoma" /></label>
            <label>Approximate period <span>required</span><input required value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. 1830s–1840s" /></label>
            <label>Your connection to this place <span>optional</span><textarea value={form.connection || ""} onChange={(e) => setForm({ ...form, connection: e.target.value })} rows={2} placeholder="e.g. My grandmother grew up here, and I want to understand the city she knew."/><small>Describe the relationship, not people’s full names.</small></label>
            <label>A family memory <span>optional</span><textarea value={form.memory || ""} onChange={(e) => setForm({ ...form, memory: e.target.value })} rows={3} placeholder="A story, object, sound, recipe, or moment you remember hearing about." /></label>
            <label>2–3 cultural interests <span>required</span><input required value={interestText} onChange={(e) => setInterestText(e.target.value)} placeholder="e.g. Native American flute, oral history, documentary film"/><small>Use public interests only. Never enter names, emails, or private identifiers.</small></label>
            <button className="primary-btn wide" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17}/> Tracing the route…</> : <>Build my atlas <ArrowRight size={17}/></>}</button>
            {error && <p className="form-error" role="alert"><CircleAlert size={15}/>{error}</p>}
          </form>
        </aside>

        <div className="journey-panel">
          <div className="journey-head">
            <div><p className="eyebrow"><span/> Judge-ready sample · disclosed memory</p><h2>{result.location.name} <small>{result.input.period}</small></h2></div>
            <span className={`service-pill status-${result.qloo.status}`}><span/>{result.qloo.status === "live" ? "Qloo live" : "Qloo transparent mode"}</span>
          </div>

          <div className="timeline-card">
            <div className="timeline-visual" role="tablist" aria-label="Historical timeline">
              {result.timeline.map((item, index) => <button key={item.id} role="tab" aria-selected={index === activeTimeline} className={index === activeTimeline ? "active" : ""} onClick={() => setActiveTimeline(index)}><span>{item.year || "Source"}</span><i/></button>)}
              <div className="timeline-line"/>
            </div>
            {activeFact ? <article className="active-fact"><EvidenceBadge type={activeFact.evidenceType}/><h3>{activeFact.title}</h3><p>{activeFact.body}</p>{activeFact.sourceUrl && <a href={activeFact.sourceUrl} target="_blank" rel="noreferrer">Open source <ExternalLink size={13}/></a>}</article> : <p>No supported historical claims were found.</p>}
          </div>

          <div className="narrative-grid">
            {result.narrative.map((item) => <article key={item.id} className="story-card"><EvidenceBadge type={item.evidenceType}/><h3>{item.title}</h3><p>{item.body}</p>{item.sourceTitle && <small>{item.sourceTitle}</small>}</article>)}
          </div>

          <section className="discoveries">
            <div className="discovery-head">
              <div><p className="section-kicker">02 / Cultural echoes</p><h2>Same roots. A different doorway.</h2></div>
              <div className="taste-switch" aria-label="Taste profile"><span>Taste lens</span><button className={profile === "rhythm" ? "active" : ""} onClick={() => swapTaste("rhythm")} disabled={loading}>Rhythm</button><button className={profile === "page" ? "active" : ""} onClick={() => swapTaste("page")} disabled={loading}>Page & screen</button></div>
            </div>
            <p className="stable-note"><Info size={15}/><strong>The timeline stays fixed.</strong> Only Qloo discoveries change when you swap taste.</p>
            {result.culturalRoute && <article className="route-card" aria-label="Qloo cultural route"><p className="section-kicker">Primary Qloo deliverable</p><h3>{result.culturalRoute.title}</h3><p>{result.culturalRoute.summary}</p><ol>{result.culturalRoute.stops.map((stop) => <li key={stop.id}><span>{stop.category}</span><strong>{stop.title}</strong></li>)}</ol></article>}
            {result.discoveries.length ? <div className="discovery-grid">{(["music", "books", "film", "destinations"] as const).map((category) => <DiscoveryColumn key={category} category={category} items={grouped[category] || []} onSelect={setSelected}/>)}</div> : <div className="qloo-empty"><Sparkles size={24}/><div><h3>Live cultural connections are waiting for the event credential.</h3><p>{result.qloo.message}</p></div></div>}
          </section>
        </div>
      </section>

      <section className="media-section" id="media">
        <div className="media-heading">
          <div><p className="section-kicker">03 / Qloo-linked public media</p><h2>Listen and watch the discoveries.</h2></div>
          <p>Playable Internet Archive or Wikimedia Commons media is found dynamically from live Qloo recommendations. The model may describe a result, but Qloo supplies the discovery and the public archive supplies the URL, creator, and free license.</p>
        </div>
        {result.media.length ? <div className="media-grid">
          {result.media.map((item) => <article className="media-card" key={item.id}>
            <div className="media-player">
              {item.mediaType === "audio"
                ? <audio controls preload="metadata" src={item.mediaUrl} aria-label={`Play ${item.title}`}>Your browser does not support this audio format.</audio>
                : <video controls preload="metadata" playsInline src={item.mediaUrl} aria-label={`Play ${item.title}`}>Your browser does not support this video format.</video>}
            </div>
            <div className="media-copy">
              <span className="media-type">{item.mediaType === "audio" ? <Headphones size={13}/> : <Film size={13}/>} {item.mediaType}</span>
              {item.relatedDiscoveryTitle && <span className="media-relation">Suggested from Qloo: {item.relatedDiscoveryTitle}</span>}
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>{item.creatorUrl ? <a href={item.creatorUrl} target="_blank" rel="noreferrer">{item.creator}</a> : item.creator} · {item.licenseUrl ? <a href={item.licenseUrl} target="_blank" rel="noreferrer">{item.license}</a> : item.license}{item.attributionVerifiedAt ? ` · verified ${item.attributionVerifiedAt}` : ""}</small>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source and license <ExternalLink size={12}/></a>
            </div>
          </article>)}
        </div> : <p className="media-empty">No playable, freely licensed public media matched the current live Qloo discoveries.</p>}
      </section>

      <section className="evidence-section" id="evidence">
        <div><p className="section-kicker">04 / Read the evidence</p><h2>Four labels. No blurred lines.</h2><p>Every output carries its evidence type all the way from the agent workflow to the interface.</p></div>
        <div className="evidence-list">{(Object.keys(evidenceMeta) as EvidenceType[]).map((type) => <div key={type}><EvidenceBadge type={type}/><p>{type === "SOURCE_BACKED_HISTORY" ? "A claim that passed URL, year, and supporting-excerpt entailment checks." : type === "FAMILY_TESTIMONY" ? "Words supplied by the user and attributed to them." : type === "QLOO_TASTE_CONNECTION" ? "An aggregate affinity from Qloo—not historical proof." : "An engaging bridge explicitly marked as imagined."}</p></div>)}</div>
      </section>

      <section className="how" id="how"><div><p className="section-kicker">AI agent flow</p><h2>Every model, source, and decision stays visible.</h2></div><ol>{result.agentTrace.length ? result.agentTrace.map((step, index) => <li key={`${step.tool}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{step.tool.replaceAll("_", " ")}</strong><p>{step.detail}</p></div><i className={step.status}/></li>) : ["AI agent parses input", "Retrieve historical sources", "AI model composition", "Resolve Qloo entities and tags", "Query Qloo Insights", "AI model media description", "Check claims"].map((label, index) => <li key={label}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{label}</strong></div></li>)}</ol></section>

      <footer><div className="brand"><span className="brand-mark"><Route size={17}/></span><span>JAGANTARA</span></div><p>Carry the story forward. Keep the labels attached.</p><span>Original hackathon MVP · 2026</span></footer>

      {selected && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="why-drawer" role="dialog" aria-modal="true" aria-label="Why this appeared" onClick={(e) => e.stopPropagation()}><button className="drawer-close" onClick={() => setSelected(null)} aria-label="Close">×</button><p className="section-kicker">Why this appeared</p><h2>{selected.title}</h2><EvidenceBadge type="QLOO_TASTE_CONNECTION"/><p>{selected.body}</p><h3>Qloo explanation</h3><ul>{selected.explanation.map((line) => <li key={line}>{line}</li>)}</ul><div className="drawer-caution"><Info size={16}/><p>This connection describes aggregate cultural affinity. It is not proof of your family’s history and not a prediction of your individual preferences.</p></div><code>entity_id: {selected.qlooEntityId}</code></aside></div>}
    </main>
  );
}

function EvidenceBadge({ type }: { type: EvidenceType }) {
  const meta = evidenceMeta[type];
  return <span className={`evidence-badge ${meta.className}`}><i/>{meta.label}</span>;
}

function AtlasMap({ location }: { location: JourneyResult["location"] }) {
  const coordinates = location.lat || location.lng
    ? `${Math.abs(location.lat).toFixed(4)}° ${location.lat >= 0 ? "N" : "S"} · ${Math.abs(location.lng).toFixed(4)}° ${location.lng >= 0 ? "E" : "W"}`
    : "Coordinates not inferred";
  return <div className="atlas-map" aria-label={`Stylized map locating ${location.name}`}><div className="map-grid"/><svg viewBox="0 0 620 430" role="img"><title>Stylized route map with the family place marked</title><path className="coast" d="M132 10c62 33 80 84 96 129 18 52 79 66 92 105 10 29-25 53-12 88 12 33 79 36 119 51M85 72c44 30 48 65 52 108 4 53 46 77 49 121 2 31-13 62-8 103M284 29c-9 62 20 98 59 123 31 19 63 45 72 85 8 35-5 63 26 91"/><path className="route-line" d="M44 330C118 300 194 339 256 292c61-45 86-132 168-166 50-20 98-10 147-44"/><circle cx="256" cy="292" r="6"/><circle cx="256" cy="292" r="16" className="pulse"/></svg><div className="map-label"><MapPin size={15}/><span>{location.name}</span><small>{coordinates}</small></div><div className="map-caption">A route, not a verdict.</div></div>;
}

function DiscoveryColumn({ category, items, onSelect }: { category: Discovery["category"]; items: Discovery[]; onSelect: (item: Discovery) => void }) {
  const Icon = categoryIcon[category];
  return <div className="discovery-column"><h3><Icon size={16}/>{category}</h3>{items.map((item) => <button key={item.id} onClick={() => onSelect(item)}><strong>{item.title}</strong><span>Why this appeared <ChevronRight size={13}/></span></button>)}</div>;
}
