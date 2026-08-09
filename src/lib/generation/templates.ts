import "server-only";
import type { ImageCandidate } from "./types";

const MANIFEST_URL_ENV = "TEMPLATES_MANIFEST_URL";

type TemplateManifestEntry = { name: string; url: string };

// R1/R13: self-hosted curated library, checked first, before any external
// search call. Seeded via scripts/seed-templates.mjs from Imgflip's popular
// list, re-hosted permanently in Vercel Blob (this is the deliberate
// exception to R10's "no permanent re-hosting" rule — that rule is about not
// hoarding arbitrary live search pass-through results, not this curated set).
export async function getCuratedTemplates(): Promise<ImageCandidate[]> {
  const manifestUrl = process.env[MANIFEST_URL_ENV];
  if (!manifestUrl) {
    // Not seeded yet — treat as an empty library rather than failing.
    return [];
  }

  const res = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    return [];
  }

  const manifest = (await res.json()) as TemplateManifestEntry[];
  return manifest.map((entry) => ({
    url: entry.url,
    title: entry.name,
    source: "template" as const,
  }));
}
