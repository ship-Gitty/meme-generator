# Project: Meme Generator

## What this is
A SaaS web application where a logged-in user types a prompt describing a meme (e.g. "cat confused about taxes"), and the system generates a caption and a matching image/GIF, lets the user edit the result, and saves it to their personal dashboard.

## Full specification
The complete requirements and architecture are defined in `docs/SPEC.md` (Software Requirements Specification + System Design Specification). Read that file in full before writing any code. It contains:
- The risk register and why specific technical decisions exist (Part I)
- Every functional and non-functional requirement, numbered FR-x / NFR-x (Part II)
- The module breakdown, data flow, data model, and third-party integrations (Part III)

## Stack (do not deviate without discussion)
- Next.js (React, App Router) — frontend and backend, deployed on Vercel
- Auth.js — authentication, with `user`/`admin` roles
- Vercel Postgres — structured data
- Vercel Blob — file storage
- Claude API (Anthropic) — keyword extraction, captions, candidate re-ranking
- Giphy API + Imgflip API — primary image/GIF sources
- Gemini API (Google) — image generation fallback only
- Upstash Redis — search result caching
- OpenAI Moderation API (or Perspective API) — caption safety check

## How this project is organized
- `docs/SPEC.md` — the full SRS/SDS, source of truth for requirements and architecture. Don't contradict it; if a build decision needs to diverge from it, flag that explicitly rather than silently deviating.
- `docs/PHASES.md` — the living build plan, broken into phases with checkboxes. Update this file's checkboxes and notes as work completes. If scope needs to change mid-phase, edit `PHASES.md` to reflect it and say so explicitly, don't just change behavior silently.
- `docs/SECURITY_AUDITS.md` — the five security audit prompts and which phase each one applies to. After finishing a phase, prompt to run the audit(s) mapped to it before starting the next phase.

## Working agreement
- Build one phase at a time. Do not start the next phase's work until told to.
- After finishing a phase, summarize what was built, update `PHASES.md`, and stop — don't proceed automatically into the next phase or into a security audit.
- If something in `SPEC.md` turns out to be impractical once you're actually building it, say so and propose an alternative rather than quietly working around it.
