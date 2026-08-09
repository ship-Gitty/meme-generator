# Build Phases

This file tracks project progress. Update checkboxes and add dated notes as phases complete. If scope changes, edit the relevant phase section directly and note why, rather than leaving this file out of sync with reality.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` complete

---

## Phase 1 — Foundation: Auth, Data, Shell UI

**Goal:** a deployable skeleton with working login and an empty dashboard. No meme generation yet.

- [x] Next.js (App Router) project initialized
- [x] Auth.js configured with login flow
- [x] `users` table extended with `role` enum (`user`/`admin`, default `user`, not user-settable) — see SPEC.md Section 14
- [x] `memes` table created per SPEC.md Section 14 (unused fields like `visibility`/`share_slug` included now, per R12)
- [x] Vercel Blob connected
- [x] Vercel Postgres connected
- [x] Minimalist login screen (NFR-10)
- [x] Dashboard shell with empty state for new users (FR-2)
- [x] `.env.example` created listing all Phase 1 environment variables
- [x] Route protection: `/dashboard` inaccessible without a valid session (FR-1)

**Security audit for this phase:** Audit 1 (Authentication & Authorization) — see `SECURITY_AUDITS.md`

**Notes:**
- 2026-08-09: Next.js scaffolded at v16.3.0 (React 19.2.8), well ahead of any prior reference material — Next 16 renamed Middleware to "Proxy" (`src/proxy.ts`, same functional API). Confirmed via the framework's own bundled docs before writing route-protection code.
- 2026-08-09: Auth.js provider is Google OAuth (`next-auth@5.0.0-beta.32`, still in beta upstream but peer-declares Next 16 support and is the current App-Router-native path). Credentials/email-password deferred to later if ever needed.
- 2026-08-09: `@vercel/postgres` is deprecated upstream (Vercel Postgres is now Neon-backed). Swapped to `@neondatabase/serverless` + Drizzle's `neon-http` driver — same "Vercel Postgres" product from the dashboard's perspective, different SDK. Flagged to and confirmed with the user before switching.
- 2026-08-09: Chose Drizzle ORM (not raw SQL) to define/query `users`/`accounts`/`sessions`/`verificationTokens` (Auth.js adapter requirements) and `memes`. Not mandated by SPEC.md, not a deviation from it either — implementation detail for the same data model in Section 14.
- 2026-08-09: `visibility` enum values set to `('private', 'public')` — SPEC.md marks this field "reserved for future sharing feature" without enumerating values; chose the minimal two-state default rather than over-specifying an unbuilt feature.
- 2026-08-09: Route protection in `src/proxy.ts` does an optimistic session check only (per Next.js's own auth guidance), but since Auth.js is configured with the `database` session strategy (not JWT), an authenticated request still costs one DB lookup per proxy invocation. Acceptable for Phase 1; revisit if this becomes a real perf issue.
- 2026-08-09: Local dev machine had no Git, Node.js, or GitHub CLI installed; installed via `winget` (Git 2.55, Node 24.19 LTS, GitHub CLI 2.97) before any of the above.
- 2026-08-09: Google OAuth (own Google Cloud project, separate from any work org), Neon Postgres, and Vercel Blob all provisioned for real via the Vercel dashboard; migration applied with `npm run db:migrate`. Full login flow verified end-to-end in the browser: Google sign-in → session created → user row written to Neon via the Drizzle adapter (confirmed `role: "user"` default, satisfying FR-22) → `/dashboard` renders correctly with the signed-in email, sign-out control, and empty state.
- 2026-08-09: Added a repo-tracked pre-commit hook (`.githooks/pre-commit`, auto-installed via `npm install`'s `prepare` script) that blocks any commit containing a secret-shaped string or a staged env file other than `.env.example`, per explicit user instruction that no key should ever reach the public repo.

---

## Phase 2 — Core Generation Pipeline

**Goal:** a user can submit a prompt and get back a rendered meme draft (not yet editable or saved).

- [x] `/api/generate` route scaffolded, auth-checked
- [x] Claude API integration: prompt → keywords + caption (FR-4) — **live-tested**
- [x] Curated template library (40 templates) stored in Vercel Blob, checked first (R1/R13 mitigation) — **live-seeded and tested**
- [x] Upstash Redis cache of prior search results, checked second — code complete, **not yet live-tested** (no Upstash account provisioned)
- [x] Giphy API integration (production key, not beta) — checked third — code complete, **not yet live-tested** (no Giphy key at all yet, beta or production)
- [x] Imgflip API integration — checked alongside Giphy — code complete, **not yet live-tested** (blocked on the Redis circuit-breaker dependency, not Imgflip itself — Imgflip needs no key)
- [x] Claude re-ranking step: pick best of 10-15 candidates against original prompt (FR-5) — **live-tested**
- [x] Gemini API fallback, triggered only when no candidate scores well (FR-6) — code complete, **not yet live-tested** (no Gemini key yet)
- [x] Moderation check (OpenAI Moderation or Perspective API) on generated caption before render (FR-19) — code complete, **not yet live-tested** (no OpenAI key yet)
- [x] Render module: composite caption onto image, Impact-style font (FR-7) — **live-tested**, visually confirmed correct
- [x] Draft returned to browser, not yet persisted (FR-8)
- [x] Retry/backoff/circuit-breaker on all external API calls (R3 mitigation)
- [x] Per-user rate limiting on generation requests (NFR-6) — code complete, not yet live-tested (same Redis dependency)

**Security audit for this phase:** Audit 2 (Injection & Input Validation) — focus on the prompt field and any URL-fetching logic (SSRF risk from image URLs) — **not yet run**, waiting until remaining credentials (Giphy, Gemini, OpenAI, Upstash) are in so the full pipeline can be exercised end-to-end first.

**Notes:**
- 2026-08-09: Model choice for all three Claude calls (keyword extraction, captioning, re-ranking) is `claude-haiku-4-5-20251001` — cheapest/fastest tier, since SPEC.md treats API cost as a first-class Phase 1+ concern (R2/R13) and none of these three tasks need a top-tier model. Revisit if caption quality feedback says otherwise.
- 2026-08-09: Claude calls use tool-use (forced function calling) rather than free-text + parsing, for reliable structured JSON output. Live-tested against a real prompt ("cat confused about taxes") — correct keywords, on-topic caption, and correct re-rank pick with sensible confidence (0.85) between two candidates.
- 2026-08-09: Confidence threshold gating the Gemini fallback (R1/R2) set to `0.6` as a starting point in `src/app/api/generate/route.ts` — tune against real fallback-trigger rate once live, not guesswork (R2's stated approach), per Recommended Technical Decision #5.
- 2026-08-09: `@vercel/postgres`-style eager-validation gotcha from Phase 1 does NOT recur here — Anthropic/OpenAI/Upstash/Google GenAI client constructors are all lazy (don't validate keys until a real call is made), so placeholder env values build cleanly. Confirmed via a clean `npm run build` before any real Giphy/Gemini/OpenAI/Upstash credentials existed.
- 2026-08-09: `@napi-rs/canvas` (server-side render module, FR-7) ships a native `.node` binary that Turbopack can't bundle — required adding `serverExternalPackages: ["@napi-rs/canvas"]` to `next.config.ts`. Discovered via a real build failure, not anticipated in advance.
- 2026-08-09: "Impact-style font" (FR-7) is rendered using Anton (Google Fonts, OFL-licensed), an open-license Impact-alike — real Impact isn't guaranteed to exist on a serverless Linux container. Font file fetched directly into `src/lib/generation/fonts/` and registered via `GlobalFonts.registerFromPath`.
- 2026-08-09: Gemini fallback (FR-6) uses `@google/genai`'s dedicated `models.generateImages` with an Imagen model (`imagen-4.0-generate-001`), not the newer "Interactions API" shown first in that package's README — the Interactions API's response shape is a complex turn/step structure poorly suited to a single fire-and-forget image generation, whereas `generateImages` is purpose-built for exactly this and has a simple, well-documented response shape (`response.generatedImages[0].image.imageBytes`). Verified against the installed package's own type definitions, not assumed.
- 2026-08-09: Added `src/lib/generation/safe-fetch.ts` — an SSRF defense-in-depth guard (host allowlist: Giphy media CDN, Imgflip, our own Blob store) applied before the render module ever fetches an image URL sourced from a third-party API response. Built proactively ahead of this phase's own Audit 2, since Audit 2's checklist explicitly names this exact risk.
- 2026-08-09: Circuit breaker (R3) state lives in Redis, not in-memory — an in-memory breaker would be nearly meaningless across stateless/concurrent serverless invocations. This means every external call (Claude, Giphy, Imgflip, Gemini, OpenAI moderation) has a hard dependency on Upstash Redis being configured, even ones that otherwise need no API key of their own (e.g. Imgflip) — confirmed directly when a live Imgflip/render test couldn't proceed past the circuit-breaker's Redis check with only a placeholder Upstash URL.
- 2026-08-09: Curated template library seed script (`scripts/seed-templates.mjs`) run live against the real Blob store from Phase 1 — 40 templates pulled from Imgflip's public (no-key) popular-templates list and permanently re-hosted in Blob, per Section 13's explicit design for this feature. This is a deliberate, SPEC-directed exception to R10's "no permanent re-hosting" rule, which is about not hoarding arbitrary live search pass-through results, not this curated set.
- 2026-08-09: `visibility`/`share_slug` question aside — `source_type` is set to `"animated"` when the chosen candidate came from Giphy (a GIF) and `"static"` otherwise, matching SPEC.md Section 14's enum, even though Phase 2's render module currently only composites a single static frame from any source (true animated compositing is explicitly Phase 4/5 scope, R9).
- 2026-08-09: Anthropic API key is real and billed to its own dedicated key (not shared with the user's other Claude Console projects); a small credit balance was added before testing. Giphy, Gemini, OpenAI, and Upstash Redis credentials are still outstanding — Phase 2 code is complete and builds/lints clean, but those four integrations are unverified against live traffic until the user provisions them.

---

## Phase 3 — Editor, Save, Export

**Goal:** a user can edit the generated draft and save/export it.

- [ ] Canvas-based editor UI (client-side)
- [ ] Edit caption text (FR-9)
- [ ] Edit text weight/color/size/position (FR-10)
- [ ] Swap image: re-search with new keywords, or upload custom image (FR-11)
- [ ] Live preview reflects edits without a server round-trip (FR-12)
- [ ] Save flow: upload final image to Blob, write metadata to Postgres (FR-13)
- [ ] Ownership check (`user_id` match) enforced on every read/write (R5/NFR-3)
- [ ] Saved meme re-openable in the same editable view, pre-populated (FR-14)
- [ ] PNG export (FR-15)
- [ ] SVG export, base64-embedded image (FR-16)
- [ ] Per-user storage quota / image compression before upload (R7)

**Security audit for this phase:** Audit 5 (Business Logic & State Management) — focus on IDOR via meme IDs and client-trusted style/metadata

**Notes:**

---

## Phase 4 — Cost Monitoring & Admin Analytics

**Goal:** usage/cost is tracked and visible to admins only; regular users have no access or visibility into it.

- [ ] `usage_log` table created per SPEC.md Section 14
- [ ] Every third-party API call logged with service, timestamp, estimated cost (FR-20)
- [ ] Monthly cost ceiling defined and enforced per service (NFR-9)
- [ ] Gemini fallback auto-disabled first if ceiling is approached (R13 mitigation)
- [ ] Admin-only analytics view: cost per service, usage vs. threshold, alert states (FR-21)
- [ ] Role assignment: `user`/`admin`, no self-service role change (FR-22)
- [ ] Server-side role check on every admin route/endpoint (FR-23)
- [ ] Non-admin hitting an admin route gets a generic not-found, not a distinguishable "access denied" (FR-24)

**Security audit for this phase:** Audit 3 (API & Data Exposure), plus a repeat of Audit 1 focused specifically on the admin role check

**Notes:**

---

## Phase 5 — Animated GIF/Video Export (future, not yet scoped for build)

**Goal:** deferred until Phases 1-4 are stable. Requires an infrastructure decision before work starts — see SPEC.md Section 5.5 and Risk R9.

- [ ] Decide: third-party media API (Cloudinary/Shotstack) vs. separate worker service — **not a Vercel serverless function**
- [ ] Time-boxed feasibility spike before any delivery date is promised
- [ ] Animated GIF export with caption applied per-frame (FR-17)
- [ ] Video export MP4/WebM (FR-18)

**Security audit for this phase:** re-run Audit 2 and Audit 4 given new dependencies

**Notes:**

---

## Ongoing, every phase

- [ ] Audit 4 (Dependency & Configuration) run at the end of every phase — this one doesn't stay valid, re-run each time
- [ ] `PHASES.md` updated with checkboxes and dated notes before moving to the next phase
