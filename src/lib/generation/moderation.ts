import "server-only";
import OpenAI from "openai";
import { callExternalApi } from "@/lib/external-api";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// FR-19/R11: screen generated captions before render. If the moderation API
// is unavailable, hold the caption rather than rendering it unscreened
// (Section 13's stated failure-handling policy) — so callers must treat a
// thrown error as "not safe to render", not "assume safe".
export async function isCaptionSafe(caption: string): Promise<boolean> {
  const result = await callExternalApi("openai-moderation", () =>
    openai.moderations.create({ input: caption })
  );
  return !result.results[0]?.flagged;
}
