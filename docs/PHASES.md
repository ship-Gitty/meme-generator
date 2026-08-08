# Build Phases

This file tracks project progress. Update checkboxes and add dated notes as phases complete. If scope changes, edit the relevant phase section directly and note why, rather than leaving this file out of sync with reality.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` complete

---

## Phase 1 — Foundation: Auth, Data, Shell UI

**Goal:** a deployable skeleton with working login and an empty dashboard. No meme generation yet.

- [ ] Next.js (App Router) project initialized
- [ ] Auth.js configured with login flow
- [ ] `users` table extended with `role` enum (`user`/`admin`, default `user`, not user-settable) — see SPEC.md Section 14
- [ ] `memes` table created per SPEC.md Section 14 (unused fields like `visibility`/`share_slug` included now, per R12)
- [ ] Vercel Blob connected
- [ ] Vercel Postgres connected
- [ ] Minimalist login screen (NFR-10)
- [ ] Dashboard shell with empty state for new users (FR-2)
- [ ] `.env.example` created listing all Phase 1 environment variables
- [ ] Route protection: `/dashboard` inaccessible without a valid session (FR-1)

**Security audit for this phase:** Audit 1 (Authentication & Authorization) — see `SECURITY_AUDITS.md`

**Notes:**
_(add dated notes here as work happens, e.g. "2026-08-10: Auth.js using GitHub provider, email/password deferred to later")_

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
