# Meme Generator — Full Project Specification

**Document status:** Draft for stakeholder review
**Prepared for review by:** Product, Engineering, Security/Risk, Budget/Timeline owners
**Stack:** Next.js (React) · Auth.js · Vercel Postgres · Vercel Blob · Vercel Hosting

This document combines three deliverables from the requirement analysis phase into one reference:

- **Part I — Risk Analysis & QA Methodology**: what could go wrong, and how it's tested for
- **Part II — Software Requirements Specification (SRS)**: what the system must do
- **Part III — System Design Specification (SDS)**: how the system is structured to do it, written for architecture review

Each requirement and design decision in Parts II and III is cross-referenced back to the risks identified in Part I, so a reviewer can trace any design choice to the problem it exists to solve.

---

## Table of Contents

**Part I — Risk Analysis & QA Methodology**
1. Risk Register
2. QA Methodology Baseline
3. Recommended Technical Decisions

**Part II — Software Requirements Specification (SRS)**
4. Introduction
5. Overall Description
6. Functional Requirements
7. External Interface Requirements
8. Non-Functional Requirements

**Part III — System Design Specification (SDS)**
9. Architectural Overview
10. Module Decomposition
11. Data Flow — Generate a Meme
12. Communication Diagram — Save Flow
13. Third-Party Integrations
14. Data Model
15. Design Decisions Traceable to Risk Analysis
16. Stakeholder Review Checklist

---

# PART I — Risk Analysis & QA Methodology

## 1. Risk Register

| ID | Risk | Category | Likelihood | Impact | Technical Solution |
|----|------|----------|------------|--------|---------------------|
| R1 | Giphy/Imgflip return no relevant match for a given prompt | Product quality | High | Medium | Check a self-hosted curated template library (30-50 popular templates) and a Redis cache of prior searches before calling any external API. On a live search, fetch 10-15 candidates and have Claude re-rank them against the original prompt (not just raw keyword search) to pick the best match or declare none good enough. |
| R2 | Gemini image generation costs spike if fallback triggers too often | Cost | Medium | High | Log fallback-trigger rate from day one. Cap Gemini calls per user per day. Tune the R1 confidence threshold based on real fallback rate, not guesswork. |
| R3 | Claude/Giphy/Gemini API outages or rate limits block generation | Availability | Medium | High | Timeouts + retries with backoff on every external call. Circuit breaker: if an API fails repeatedly, skip it gracefully (e.g. use a stock caption) rather than hanging the request. |
| R4 | API keys exposed client-side | Security | Low (if built correctly) | Critical | All third-party calls (Claude, Giphy, Gemini) run only in Next.js API routes, never in client code. Enforced by code review, not just convention. |
| R5 | Unauthenticated or cross-user access to saved memes | Security | Medium | Critical | Auth.js session check on every API route touching Postgres/Blob. Row-level ownership check (`user_id` match) on every read/write, not just at the auth layer. |
| R6 | Concurrent generation requests degrade performance under load | Scalability | Medium | Medium | Serverless functions on Vercel scale per-request by default — verify with load testing before launch, don't assume. Set per-user rate limits to prevent one user from exhausting shared API quotas (Claude/Giphy/Gemini have their own rate limits, separate from your infra). |
| R7 | Vercel Blob storage costs grow unpredictably as users generate more memes | Cost | Medium | Medium | Set a per-user storage quota. Compress/resize images before upload. Consider a retention policy (e.g. auto-delete drafts never saved). |
| R8 | Canvas-based editor behaves inconsistently across browsers | Compatibility | Medium | Medium | Target evergreen browsers only (Chrome, Firefox, Safari, Edge — latest 2 versions). Manual cross-browser test pass before each release, not just Chrome dev testing. |
| R9 | Animated GIF/video export (Phase 4) is technically complex and can blow the timeline | Schedule | High | High | Explicitly scoped as its own phase, built last, after the static pipeline is proven. ffmpeg-style rendering does not fit Vercel's serverless execution time limits — Phase 4 requires a dedicated media processing API (e.g. Cloudinary, Shotstack) or a separate worker service, decided before a delivery date is promised, not discovered mid-build. |
| R10 | Copyright/content risk from Giphy/Imgflip images or AI-generated images | Legal/Compliance | Medium | Medium | Never permanently re-host or store Giphy/Imgflip source images beyond the final composited meme — treat them as pass-through, not owned assets. In-app disclaimer noting templates are sourced via Giphy/Imgflip under their terms. Full read of both services' commercial-use terms required before any paid tier of the product launches. |
| R11 | AI-generated captions produce offensive/inappropriate content | Reputation | Medium | High | Use a dedicated moderation API (OpenAI Moderation endpoint or Google's Perspective API) on both extracted keywords and the generated caption before rendering — not just a keyword blocklist. |
| R12 | Database schema doesn't anticipate future needs (e.g. sharing, public gallery) | Technical debt | Medium | Low | Design the `memes` table with a few forward-looking nullable fields (e.g. `visibility`, `share_slug`) now, even if unused in Phase 1 — cheaper than a migration later. |
| R13 | The product is built assuming free-tier usage of Giphy/Imgflip/Claude, but real usage hits rate limits, or Gemini fallback costs exceed what "free" can sustain | Cost/Availability | High | High | Track free-tier quota consumption per service from day one (not after a bill or a block). Set a hard usage ceiling per service; when approached, disable the paid fallback (Gemini) first and degrade to a "no match found, try a different prompt" state rather than silently failing or incurring unplanned cost. Decide *before* launch what the actual monthly budget ceiling is, and treat every "free" API as free-until-a-limit, not permanently free. |
| R14 | A regular user gains access to the admin analytics view (cost data, usage patterns) due to a missing or client-only role check | Security | Medium | Medium | Enforce role checks server-side on every admin route and API call, never by hiding a UI link alone. Non-admin access attempts return a generic not-found/denied response rather than confirming the admin section's existence. Role field is never writable through any user-facing endpoint. |

## 2. QA Methodology Baseline

### Testing pyramid
- **Unit tests** — pure logic: keyword extraction parsing, text-style validation, Postgres query builders. Fast, run on every commit.
- **Integration tests** — API routes with mocked external services (Claude, Giphy, Gemini, Blob, Postgres). Verifies your code's behavior without depending on live third-party uptime or cost.
- **End-to-end tests** — real browser flow: login → generate → edit → save → appears on dashboard. Run before each deploy, not on every commit (slower, costs real API calls if not mocked).

### Per-risk test coverage
| Risk | Test approach |
|------|---------------|
| R1, R2 | Integration tests with a fixture set of prompts, asserting fallback triggers only below the confidence threshold |
| R3 | Chaos-style tests: force each external API to fail/timeout, confirm graceful degradation (no unhandled crash) |
| R4, R5 | Automated check that no `ANTHROPIC_API_KEY`/`GIPHY_API_KEY`/`GEMINI_API_KEY` appears in any client-bundled JS. Auth bypass attempts (accessing another user's meme ID) as a standing test case |
| R6 | Load test (e.g. k6 or Artillery) simulating concurrent generation requests before launch |
| R8 | Manual cross-browser pass on the editor each release; automate with Playwright across browser engines if time allows |
| R11 | Test set of edge-case prompts (offensive, ambiguous, adversarial) run against the moderation step |
| R14 | Log in as a `user` role, attempt to reach every admin route/API directly by URL, confirm consistent denial |

### Process baseline
- **Code review required** on every PR touching auth, API routes, or anything handling API keys — no self-merge on security-sensitive paths.
- **CI gate**: unit + integration tests must pass before merge to main.
- **Staging environment** on Vercel (preview deployments) before promoting to production — test the real deploy, not just local dev.
- **Monitoring from day one**: error tracking (e.g. Sentry) and API cost/usage dashboards for Claude, Giphy, Gemini — catch R2/R3/R7 early, not after the bill arrives.

## 3. Recommended Technical Decisions

To carry into Phase 1 build, based on the risk register above:

1. Keyword-extraction step is mandatory before any image search — never search raw user prompts directly.
2. All external API calls live exclusively in Next.js API routes.
3. Every Postgres/Blob operation checks `user_id` ownership, not just session validity.
4. Rate limits and quotas (per-user) ship in Phase 1, not bolted on later — cheaper to build in from the start than retrofit.
5. Gemini fallback rate gets logged and reviewed weekly post-launch to catch cost creep early.
6. GIF/video export (R9) stays a separate, later phase with its own time-boxed feasibility spike before a deadline is promised to anyone.
7. Basic content moderation on generated captions ships in Phase 1, before public users can generate content.
8. A monthly cost/quota ceiling is defined before launch, with the paid fallback (Gemini) as the first thing disabled if that ceiling is approached — not an afterthought once a bill arrives.
9. A curated template library and result cache are checked before any external search call, reducing both poor matches (R1) and rate-limit/cost exposure (R13) at the source.
10. Server-side role verification is enforced on every admin route, with the role field never writable through any user-facing endpoint (R14).

This keeps Phase 1 scope disciplined: auth, generation, editing, and static export — with the guardrails (ownership checks, rate limits, moderation, role checks) built in from the start rather than treated as later hardening work.

---

# PART II — Software Requirements Specification (SRS)

## 4. Introduction

### 4.1 Purpose
This document specifies the functional and non-functional requirements for the Meme Generator web application. It is the reference used to validate that the built product matches agreed scope, and to evaluate design tradeoffs during architecture review.

### 4.2 Scope
The product is a web application where an authenticated user submits a natural-language prompt describing a meme. The system generates a caption and sources or generates a matching image, renders them together, and lets the user edit the result before saving it to their personal dashboard.

Out of scope for the initial release: public sharing/discovery of memes, mobile native apps, team/organization accounts, and monetization/billing.

### 4.3 Definitions, Acronyms, Abbreviations
| Term | Meaning |
|------|---------|
| SRS | Software Requirements Specification |
| SDS | System Design Specification (also called Design Document Specification, DDS) |
| FR | Functional Requirement |
| NFR | Non-Functional Requirement |
| Meme | An image or GIF with overlaid caption text, generated or edited by a user |
| Fallback generation | Producing an image via Gemini when no suitable Giphy/Imgflip result exists |

### 4.4 References
- Anthropic Claude API documentation
- Giphy API documentation
- Imgflip API documentation
- Google Gemini image generation API documentation
- Auth.js documentation
- Vercel Postgres and Vercel Blob documentation

### 4.5 Document Overview
Part II defines *what* the system must do (requirements). Part III defines *how* the system is structured to do it (architecture, modules, data flow, third-party integration), written from the perspective of the system architect for stakeholder design review.

## 5. Overall Description

### 5.1 Product Perspective
This is a new, standalone SaaS web product. It is not a replacement for or extension of an existing system. It depends on four external services for core functionality (Claude, Giphy, Imgflip, Gemini) and two Vercel-managed services for persistence (Postgres, Blob).

### 5.2 Product Functions (summary)
1. User authentication and session management
2. Prompt-driven meme generation (caption + image sourcing/generation)
3. Post-generation editing (text, style, image swap)
4. Persistence of generated memes to a per-user dashboard
5. Export of the final meme in one or more formats

### 5.3 User Classes and Characteristics
| User class | Description | Technical proficiency |
|---|---|---|
| End user | Signs up, generates memes, edits, saves, exports | Low — no assumption of technical skill |
| Administrator | Views API usage, cost, and threshold status; no content moderation tooling in this phase | Low — dashboard only, no config screens required |

### 5.4 Operating Environment
- Client: modern evergreen browsers (Chrome, Firefox, Safari, Edge — latest two major versions), desktop and mobile web
- Server: Vercel serverless (Node.js runtime)
- No native mobile app; no offline mode

### 5.5 Design and Implementation Constraints
- Must run on Vercel's serverless model — no long-lived server processes
- All third-party API keys must remain server-side only
- Must operate within the free/low tiers of Giphy and Imgflip where possible, using Gemini only as a paid fallback, and must not assume any third-party service is free without limit (see NFR-9, Risk R13)
- The user interface shall be minimalistic: a small, deliberate set of screens (login, dashboard, generate/edit) with no unnecessary controls, clutter, or decorative elements. Prompt input and the generated result should be the visual focus of the generation screen; editing controls should be simple and unobtrusive until needed.
- Initial release excludes animated GIF/video generation and export (see Section 10, Phase 4). Phase 4, when scoped, requires either a third-party media processing API or a separate worker service (not a Vercel serverless function), since ffmpeg-style rendering does not fit serverless execution time limits — this is a distinct infrastructure decision, not an extension of the existing API routes.

### 5.6 Assumptions and Dependencies
- Giphy, Imgflip, Claude, and Gemini APIs remain available and within their documented rate limits
- Vercel Postgres and Vercel Blob are provisioned and reachable from all API routes
- Users have valid credentials for whichever Auth.js provider is configured

## 6. Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | The system shall require authentication via Auth.js before granting access to `/dashboard` or any generation feature | Must |
| FR-2 | The system shall display a user's previously saved memes on their dashboard, with an empty state for new users | Must |
| FR-3 | The system shall accept a free-text prompt describing a desired meme | Must |
| FR-4 | The system shall call the Claude API to derive image search keywords and a caption from the prompt | Must |
| FR-5 | The system shall search Giphy and Imgflip using the derived keywords and select the best available match | Must |
| FR-6 | The system shall fall back to Gemini image generation only when no sufficiently relevant Giphy/Imgflip result is found | Must |
| FR-7 | The system shall render the caption onto the selected/generated image (top/bottom placement, Impact-style font, white text with black outline) as the initial draft | Must |
| FR-8 | The system shall present the generated draft in an editable view before saving | Must |
| FR-9 | The user shall be able to edit the caption text | Must |
| FR-10 | The user shall be able to change text weight (bold/regular), color, size, and position | Must |
| FR-11 | The user shall be able to replace the image, either by re-searching Giphy/Imgflip with new keywords or by uploading a custom image | Must |
| FR-12 | The system shall reflect all edits in a live preview without requiring a save | Must |
| FR-13 | The user shall be able to save the edited meme, persisting the final image to storage and its metadata to the database | Must |
| FR-14 | A saved meme shall be re-openable in the same editable view, pre-populated with its saved state | Must |
| FR-15 | The user shall be able to export the final meme as a PNG | Must |
| FR-16 | The user shall be able to export the final meme as an SVG (image embedded as base64) | Should |
| FR-17 | If the source is an animated GIF, the user shall be able to export an animated GIF with caption applied across frames | Could (Phase 4) |
| FR-18 | If the source is animated, the user shall be able to export a video (MP4/WebM) of the captioned result | Could (Phase 4) |
| FR-19 | The system shall apply a content-moderation check to AI-generated captions before rendering | Must |
| FR-20 | The system shall log every call to a paid or rate-limited third-party API (Claude, Giphy, Imgflip, Gemini), recording timestamp, service, and estimated cost | Must |
| FR-21 | The system shall provide an analytics view, restricted to users with the `admin` role, showing cumulative dollar cost per service, current usage against each service's rate-limit/free-tier threshold, and a visual/alert state when a threshold is approached or exceeded | Must |
| FR-22 | The system shall assign every user a role of `user` or `admin` at the account level, defaulting to `user`, with no user-facing mechanism to change their own role | Must |
| FR-23 | The system shall verify the requesting user's role on the server for every admin-only route and API endpoint, independent of any client-side UI state | Must |
| FR-24 | The system shall return the same not-found or access-denied response to a non-admin user attempting to reach an admin route directly by URL as it would for a route that does not exist, rather than revealing that an admin section exists | Should |

## 7. External Interface Requirements

### 7.1 User Interfaces
- Login screen (Auth.js-provided or custom UI wrapping it)
- Dashboard: grid/list of saved memes, "Generate new meme" entry point
- Generation/edit screen: prompt input, live Canvas preview, editing controls, save/export actions

### 7.2 External Service Interfaces
| Interface | Direction | Data exchanged |
|---|---|---|
| Claude API | Outbound | Prompt in; keywords + caption text out |
| Giphy API | Outbound | Keywords in; image/GIF URLs + metadata out |
| Imgflip API | Outbound | Keywords/template list in; template image URLs out |
| Gemini API | Outbound | Prompt/keywords in; generated image out |
| Auth.js provider | Bidirectional | Credentials/session tokens |
| Vercel Postgres | Bidirectional | Meme records, user references |
| Vercel Blob | Bidirectional | Final rendered image files |

## 8. Non-Functional Requirements

| ID | Requirement | Category |
|----|-------------|----------|
| NFR-1 | The system shall support multiple users generating memes concurrently without one user's request blocking another's | Performance/Scalability |
| NFR-2 | API keys for all third-party services shall never be exposed to client-side code | Security |
| NFR-3 | A user shall only be able to read or modify their own saved memes | Security |
| NFR-4 | The system shall degrade gracefully (not crash or hang) if any single external API is unavailable | Reliability |
| NFR-5 | Generation requests should complete within a reasonable interactive window; if exceeded, the UI shall show progress rather than appear frozen | Usability |
| NFR-6 | Per-user rate limits shall exist to prevent one user from exhausting shared third-party API quotas | Cost/Reliability |
| NFR-7 | The editor shall function consistently across the latest two versions of major evergreen browsers | Compatibility |
| NFR-8 | Storage usage per user shall be bounded by quota or lifecycle policy | Cost |
| NFR-9 | The system shall track usage against each third-party API's free-tier limit and enforce a hard monthly cost ceiling, disabling paid fallback (Gemini) before that ceiling is exceeded, with current status visible via the analytics view (FR-21) | Cost |
| NFR-10 | The user interface shall be minimalistic: each screen shall expose only the controls relevant to the user's current task, with no decorative elements that don't support a function | Usability |
| NFR-11 | Role checks (`user` vs `admin`) shall be enforced in the API layer on the server, never solely by hiding UI elements on the client; a regular user shall receive no data, response content, or navigation option that reveals the analytics view exists | Security |

---

# PART III — System Design Specification (SDS)

## 9. Architectural Overview

The system follows a three-layer architecture, deployed as a single Next.js application on Vercel:

1. **Presentation layer** — React components rendered by Next.js (pages, dashboard, editor)
2. **Application layer** — Next.js API routes (Node.js, serverless), containing all business logic and third-party orchestration
3. **Data layer** — Vercel Postgres (structured metadata) and Vercel Blob (binary image/GIF files)

This keeps a single deployable unit and avoids operating a separate backend service, which fits Vercel's serverless execution model and satisfies the concurrency requirement (NFR-1) since each request is handled by an independently scaled function instance.

## 10. Module Decomposition

| Module | Responsibility | Primary interfaces |
|---|---|---|
| Auth module | Session creation, validation, route protection, and role-based authorization (`user` vs `admin`) | Auth.js, Postgres (user table) |
| Prompt interpretation module | Sends user prompt to Claude, receives keywords + caption | Claude API |
| Image sourcing module | Checks curated template library first, then cached results, then queries Giphy/Imgflip; sends candidates to Claude for re-ranking; triggers Gemini fallback only if no candidate scores well | Vercel Blob (curated library), Upstash Redis (cache), Giphy API, Imgflip API, Claude API (re-ranking), Gemini API |
| Render module | Composites caption onto image (server-side for initial draft, client-side Canvas for edits) | Internal only |
| Editor module | Client-side Canvas UI: text style controls, image swap, live preview | Image sourcing module (for re-search), Render module |
| Persistence module | Saves final meme file to Blob, saves metadata to Postgres | Vercel Blob, Vercel Postgres |
| Moderation module | Screens AI-generated captions before render using a dedicated moderation API | Claude API output, OpenAI Moderation API (or Perspective API) |
| Usage & cost monitoring module | Logs every third-party API call with cost/quota impact; computes running totals against thresholds; powers the analytics view; triggers fallback-disable when a ceiling is hit | All external API calls (cross-cutting), Postgres (usage_log table) |

## 11. Data Flow — Generate a Meme (primary use case)

```
User (browser)
   |  1. submit prompt
   v
Next.js API route: /api/generate
   |  2. auth check
   v
Auth module ---> confirms session ---> continue
   |  3. send prompt
   v
Prompt interpretation module ---> Claude API ---> keywords + caption
   |  4. check curated template library (Blob) ---> hit? use it, skip to step 7
   |  5. check cache (Redis, by keyword) ---> hit? use it, skip to step 7
   |  6. cache miss: search Giphy API + Imgflip API ---> top 10-15 candidates
   v
Image sourcing module ---> Claude API (re-rank candidates against original prompt)
   |
   |-- good match found -----------------------------> cache result, use it
   |-- no candidate scores well ----------------------> Gemini API ---> generated image
   v
Moderation module ---> OpenAI/Perspective moderation API screens caption
   v
Render module ---> composites caption onto image (initial draft)
   v
Response returned to browser (draft image + metadata, not yet saved)
   |  7. user edits in Canvas editor (client-side, no round-trip)
   v
User clicks Save
   |  8. POST /api/memes
   v
Persistence module ---> Vercel Blob (image file) + Vercel Postgres (metadata)
   v
Dashboard updated with new meme
```

## 12. Communication Diagram — Save Flow

```
Browser --(final image blob + style metadata)--> /api/memes (Next.js API route)
/api/memes --(auth check)--> Auth module
/api/memes --(upload file)--> Vercel Blob --(returns URL)--> /api/memes
/api/memes --(insert record: user_id, prompt, caption, image_url, text_style, source_type)--> Vercel Postgres
/api/memes --(success + meme record)--> Browser
```

## 13. Third-Party Integrations

| Service | Purpose | Failure handling | Cost consideration |
|---|---|---|---|
| Claude API (Anthropic) | Keyword extraction, caption writing, candidate re-ranking | Timeout + retry with backoff; fallback to a generic caption template if repeated failure | Per-call cost, low relative to image generation. Re-ranking adds one extra call per generation, still cheap. |
| Giphy API | Primary image/GIF source (checked only after curated library and cache miss) | If no relevant result, proceed to Imgflip, then Gemini | Apply for a production API key (not the default beta key) for higher rate limits. Free tier, rate-limited. |
| Imgflip API | Secondary static template source | Same fallback chain as Giphy | Free, no key required for template listing |
| Curated template library | Self-hosted set of 30-50 popular templates, checked first, before any external API call | N/A — internally hosted, no external dependency | One-time setup cost; eliminates the majority of external calls for common prompts |
| Upstash Redis (or similar) | Caches Giphy/Imgflip search results by keyword for 24-48 hours | Cache miss simply falls through to a live search; not a hard dependency | Free tier typically sufficient at this scale |
| Gemini API (Google) | Fallback image generation, used only when curated library, cache, and re-ranked Giphy/Imgflip candidates all fail to produce a good match | Timeout + retry; if unavailable, return a "no image found" state and allow manual upload | Paid per generation — monitored per Risk R2/R13, reduced in practice by the caching + re-ranking steps above |
| OpenAI Moderation API (or Perspective API) | Screens generated captions for inappropriate content before render | If unavailable, hold the caption for manual review rather than rendering unscreened content | Free tier available, purpose-built for this use case |
| Media processing API (e.g. Cloudinary or Shotstack) — Phase 4 only | Renders captioned GIF/video output; avoids running ffmpeg inside Vercel serverless functions, which is not viable given execution time limits | If unavailable, fall back to static PNG export only for that request | Usage-based; evaluated only when Phase 4 is scoped |
| Auth.js | Authentication, session management, and role-based authorization | Standard provider-level error handling; unauthenticated or wrong-role requests rejected at the API route boundary | No direct cost beyond provider fees, if any |
| Vercel Postgres | Metadata persistence | Standard DB connection retry; transactional writes for meme save | Usage-based, scales with saved meme count |
| Vercel Blob | Binary file storage (final memes + curated template library) | Standard retry on upload failure; orphaned-blob cleanup job (future) | Usage-based, scales with storage volume — monitored per Risk R7 |

## 14. Data Model

**users** — managed by Auth.js (id, email, provider fields, created_at), extended with:
| Field | Type | Notes |
|---|---|---|
| role | enum | `user` or `admin`. Defaults to `user` on signup. Only changeable via direct database action or a future admin-management tool — never via any user-facing API route. |

**memes**
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| user_id | UUID | Foreign key to users, enforced on every query (NFR-3) |
| prompt | text | Original user prompt |
| caption | text | Final caption text |
| image_url | text | Vercel Blob URL |
| text_style | jsonb | Color, weight, size, position |
| source_type | enum | `static` or `animated` |
| visibility | enum | Reserved for future sharing feature, defaults to `private` |
| share_slug | text, nullable | Reserved for future sharing feature |
| created_at | timestamp | |
| updated_at | timestamp | |

**usage_log**
| Field | Type | Notes |
|---|---|---|
| id | UUID | Primary key |
| service | enum | `claude`, `giphy`, `imgflip`, `gemini` |
| called_at | timestamp | |
| estimated_cost | numeric | 0 for free-tier calls; actual per-call cost for Gemini |
| threshold_status | enum | `normal`, `approaching`, `exceeded` — computed at write time against the current monthly ceiling |

## 15. Design Decisions Traceable to Risk Analysis

| Design decision | Risk mitigated |
|---|---|
| Keyword extraction step before any image search | R1 (irrelevant results) |
| Confidence threshold gating the Gemini fallback | R1, R2 (cost) |
| Retry + backoff + circuit-breaker pattern on all external calls | R3 (API outages) |
| API keys confined to server-side API routes only | R4 (key exposure) |
| `user_id` ownership check on every Postgres/Blob operation | R5 (cross-user access) |
| Per-user rate limits on generation | R6 (concurrency abuse), NFR-6 |
| Per-user storage quota, image compression before upload | R7 (storage cost) |
| GIF/video export isolated to a later, separately time-boxed phase | R9 (schedule risk) |
| Moderation pass on generated captions before render | R11 (reputational risk) |
| Nullable `visibility`/`share_slug` fields added now, unused until needed | R12 (schema rework) |
| Per-service quota tracking and a hard monthly cost ceiling, with Gemini disabled first if approached, surfaced via a live analytics/admin view (FR-20, FR-21) | R13 (free-tier dependency, unplanned cost) |
| Server-side role verification on every admin route, role field never user-writable, generic denial response instead of confirming admin section exists | R14 (unauthorized access to analytics/cost data), NFR-11 |
| Curated template library + result caching (Upstash Redis), checked before any external search call | R1 (poor matches), R13 (rate limits/cost) — reduces external call volume at the source |
| Claude re-ranks Giphy/Imgflip candidates against the original prompt instead of trusting raw keyword search | R1 (irrelevant results), R13 (unnecessary Gemini fallback from bad matches) |
| Phase 4 (GIF/video) offloaded to a dedicated media API or separate worker service, never run as ffmpeg inside a Vercel function | R9 (schedule risk from a technically infeasible approach) |
| No permanent re-hosting of Giphy/Imgflip source images beyond the final composited meme; in-app attribution disclaimer; commercial ToS review required before any paid tier | R10 (legal/copyright exposure) |
| Dedicated moderation API (OpenAI Moderation or Perspective) replacing a keyword-only filter | R11 (offensive/inappropriate generated content) |
| Minimalistic UI: fixed small set of screens, no decorative or non-functional elements | NFR-10 (usability); also reduces surface area for R8 (cross-browser inconsistency), since fewer custom components means fewer things to break per browser |

## 16. Stakeholder Review Checklist

This document should be reviewed against the following lenses before implementation begins:

- **Risk assessment** — does Section 15 address every high/critical item in the Risk Register (Section 1)?
- **Product robustness** — does Section 11 (data flow) degrade gracefully at every external dependency?
- **Design modularity** — can any module in Section 10 be replaced (e.g. swapping Gemini for another provider) without touching unrelated modules?
- **Budget** — are Gemini fallback rate and Blob storage growth monitored from Phase 1, not after costs are already incurred (Section 3)?
- **Time constraints** — is GIF/video export correctly isolated as a later phase rather than a Phase 1 dependency?

---

*End of document. Recommend circulating Part II to product/business stakeholders and Part III to engineering/security stakeholders, then reconciling any conflicting feedback in a single review session before Phase 1 build begins.*
