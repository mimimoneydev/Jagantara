# Jagantara

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

## About

Jagantara is an evidence-aware heritage and cultural discovery agent. A user supplies a family place, an approximate period, their optional connection to that place, an optional memory, and two or three public cultural interests. The app returns a sourced timeline, a carefully labeled narrative, and—when the event credential is configured—live Qloo discoveries across music, books, film, and destinations.

Jagantara is open-source software released under the [MIT License](./LICENSE), allowing reuse, modification, and distribution under the license terms.

The account-free judge journey offers four disclosed fictional samples: Native American history centered on Tahlequah and the Cherokee Nation, Irish and Italian immigration in New York, and African American history in Harlem. The samples do not claim ancestry, and every historical claim links to a retrievable source. Swapping the taste lens keeps a selected sample’s facts byte-for-byte stable while sending a different set of resolved Qloo entity IDs to Insights.

Each sample also includes inline playable audio or video from Wikimedia Commons. Media URLs, creators, and free-license labels come from a fixed allowlist. When OpenRouter is available, it may refine the short descriptions using only that supplied metadata; it cannot add or replace player URLs.

## Why Qloo is indispensable

The historical layer and the taste layer deliberately do different jobs. Public historical sources establish what is documented about a place and period. Qloo establishes aggregate, cross-domain cultural affinity between selected public interests and discoveries. Without Qloo, Jagantara can still show the sourced history, but it refuses to invent the culturally connected music, books, films, or destinations. That honest empty state is part of the product contract.

The server workflow:

1. Validates and normalizes place, period, attributed personal context, memory, and 2–3 interests.
2. Retrieves historical source pages and retains their URLs.
3. Optionally asks DeepSeek through OpenRouter to compose only from those retrieved source excerpts.
4. Searches Qloo `/search` once per interest and stores the returned entity IDs.
5. Calls Qloo `/v2/insights` for `artist`, `book`, `movie`, and `destination` with `signal.interests.entities` and `feature.explainability=true`.
6. Rejects source-backed history without a URL and Qloo connections without a Qloo entity ID.
7. Returns a visible tool trace and evidence type on every item.

Every output is persisted in the response as one of:

- `SOURCE_BACKED_HISTORY`
- `FAMILY_TESTIMONY`
- `QLOO_TASTE_CONNECTION`
- `CREATIVE_RECONSTRUCTION`

Jagantara never infers ethnicity or genealogy from a surname, and Qloo affinities are never described as historical proof or as an individual preference.

## Stack and architecture

- Next.js 16 + TypeScript + React 19 (built through Vinext for Cloudflare Workers/Sites)
- Server-side route handlers under `app/api`
- A tool-oriented agent orchestrator in `lib/agent.ts`
- Direct, server-only Qloo client in `lib/qloo.ts`
- Wikimedia API source retrieval with linked Wikipedia evidence in `lib/history.ts`
- Optional OpenRouter chat-completions adapter in `lib/openrouter.ts`
- No database is required for the account-free MVP; Qloo GET results use a bounded in-memory cache (64 entries, 10-minute TTL)

## Local setup

Prerequisites: Node.js 22.13+.

```bash
npm ci
cp .env.example .env
npm run dev
```

Request a personal hackathon key using [Qloo’s API key request form](https://forms.gle/zz12orkLHTAneLGz6). Qloo provisions keys manually and sends them by email, typically within a few business days. Configure the received key as `QLOO_API_KEY` only in `.env` or the host’s secret manager. It is read only in server code and must never use a `NEXT_PUBLIC_` prefix.

Hackathon keys work only with `https://hackathon.api.qloo.com`. The client defaults to that URL and rejects staging, production, or URL paths supplied through `QLOO_BASE_URL`, preventing the wrong-environment 401 described in the official guide.

To enable model-assisted composition through OpenRouter, set `LLM_PROVIDER=openrouter`, `LLM_MODEL=deepseek/deepseek-v4.1-flash`, and `OPENROUTER_API_KEY` server-side. The adapter requests JSON output and disables model reasoning for this bounded composition step so the completion budget is reserved for the final evidence-linked response.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The tests cover OpenRouter’s request contract, Wikimedia source retrieval, evidence/claim labeling, multiple Qloo response shapes, honest 401/403/429 behavior, and taste-swap invariants with mocked Qloo calls.

To exercise the compiled Cloudflare Worker locally with the variables in `.env`:

```bash
npm start
```

The production-style server listens on `http://127.0.0.1:8787`. Check `GET /api/health` to confirm that Qloo and OpenRouter are configured; the endpoint reports configuration state but never returns credentials or credential fragments.

## Qloo contract and failure behavior

The implementation follows the current public Qloo documentation and hackathon kit:

- Hackathon base URL: `https://hackathon.api.qloo.com`
- Authentication: `X-Api-Key` request header
- Entity resolution: `GET /search?query=...`
- Recommendations: `GET /v2/insights`
- Output category: `filter.type`
- Taste signals: `signal.interests.entities`
- Explanation request: `feature.explainability=true`

Hackathon keys have rate and monthly quota limits, and remain active through the end of judging. Qloo can raise limits per user through the hackathon support channel, so the code does not hard-code invented numbers. It reports 401 authentication failures, 403 unsupported entity types, 429 plus `Retry-After` when supplied, 400/unsupported-query responses, empty results, and two bounded 25-second attempts. No failure path substitutes recommendations.

The integration does not use the unsupported legacy `/recs` or `/recommendations` endpoints. Free-form interests are first resolved through `/search`; only returned Qloo entity IDs are passed to Insights.

The parser accepts the documented `results.entities` shape and defensive variants observed across Qloo surfaces. Live verification still depends on the validity, quota, and permissions of the configured event-issued credential.

## Deployment

This repository includes `.openai/hosting.json` for Sites. Build and deploy with the Sites workflow, then set `QLOO_API_KEY`, `QLOO_BASE_URL`, `LLM_PROVIDER`, `LLM_MODEL`, and `OPENROUTER_API_KEY` as server-only secrets in the hosting secret manager and redeploy. On another compatible host, configure the same server-only values and run the production build.

The public host must expose `/api/journey` and `/api/health`; a static export is insufficient.

## Responsible-use notes

- Do not send names, email addresses, account IDs, exact location histories, or other personal data to Qloo.
- The optional memory is not sent to Qloo; only the explicitly selected public cultural-interest strings are searched.
- Wikipedia is a retrieval starting point, not a substitute for archival research. The UI always exposes the source URL.
- The sample memory is fictional and visibly disclosed.
- No audio is generated in the MVP; this was intentionally left after the core provenance workflow.

## License

MIT — see [LICENSE](./LICENSE).
