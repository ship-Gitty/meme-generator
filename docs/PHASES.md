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
- 2026-08-09: Route protection in `src/proxy.ts` was initially assumed to be an optimistic, cookie-only check per Next.js's general auth guidance. Audit 1 (below) traced Auth.js's actual runtime code and found this is wrong: because the app uses the `database` session strategy, `auth()` performs a real adapter (DB) lookup on every matched request — it's authoritative, not optimistic. Comment corrected in code and here.
- 2026-08-09: Local dev machine had no Git, Node.js, or GitHub CLI installed; installed via `winget` (Git 2.55, Node 24.19 LTS, GitHub CLI 2.97) before any of the above.
- 2026-08-09: Google OAuth (own Google Cloud project, separate from any work org), Neon Postgres, and Vercel Blob all provisioned for real via the Vercel dashboard; migration applied with `npm run db:migrate`. Full login flow verified end-to-end in the browser: Google sign-in → session created → user row written to Neon via the Drizzle adapter (confirmed `role: "user"` default, satisfying FR-22) → `/dashboard` renders correctly with the signed-in email, sign-out control, and empty state.
- 2026-08-09: Added a repo-tracked pre-commit hook (`.githooks/pre-commit`, auto-installed via `npm install`'s `prepare` script) that blocks any commit containing a secret-shaped string or a staged env file other than `.env.example`, per explicit user instruction that no key should ever reach the public repo.
- 2026-08-09: **Audit 1 (Authentication & Authorization) run**, via an independent fresh review pass. Result: no Critical/High/Medium findings. Two Low/informational notes: (1) the `proxy.ts` comment inaccuracy above, now fixed; (2) `proxy.ts`'s matcher won't automatically cover future API routes (e.g. Phase 2's `/api/generate`) — each new route will need its own explicit `auth()` check, which matches NFR-3/NFR-11's server-layer enforcement approach and is the plan, not a gap to fix now. `role` privilege escalation, cross-user data access (dashboard query), hardcoded secrets, JWT/secret handling, and open-redirect risk on the login page all checked clean. Full report not persisted verbatim here — re-run this audit's admin-role-focused subset again at Phase 4 per `SECURITY_AUDITS.md`.

---

## Phase 2 — Core Generation Pipeline

**Goal:** a user can submit a prompt and get back a rendered meme draft (not yet editable or saved).

- [ ] `/api/generate` route scaffolded, auth-checked
- [ ] Claude API integration: prompt → keywords + caption (FR-4)
- [ ] Curated template library (30-50 templates) stored in Vercel Blob, checked first (R1/R13 mitigation)
- [ ] Upstash Redis cache of prior search results, checked second
- [ ] Giphy API integration (production key, not beta) — checked third
- [ ] Imgflip API integration — checked alongside Giphy
- [ ] Claude re-ranking step: pick best of 10-15 candidates against original prompt (FR-5)
- [ ] Gemini API fallback, triggered only when no candidate scores well (FR-6)
- [ ] Moderation check (OpenAI Moderation or Perspective API) on generated caption before render (FR-19)
- [ ] Render module: composite caption onto image, Impact-style font (FR-7)
- [ ] Draft returned to browser, not yet persisted (FR-8)
- [ ] Retry/backoff/circuit-breaker on all external API calls (R3 mitigation)
- [ ] Per-user rate limiting on generation requests (NFR-6)

**Security audit for this phase:** Audit 2 (Injection & Input Validation) — focus on the prompt field and any URL-fetching logic (SSRF risk from image URLs)

**Notes:**

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
