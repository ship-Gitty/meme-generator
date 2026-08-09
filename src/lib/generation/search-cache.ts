import "server-only";
import { redis } from "@/lib/redis";
import type { ImageCandidate } from "./types";

// R1/R13: cache Giphy/Imgflip search results by keyword for 24-48h, checked
// before any live external search call.
const CACHE_TTL_SECONDS = 60 * 60 * 36;

function cacheKey(keywords: string[]): string {
  const normalized = keywords.map((k) => k.toLowerCase().trim()).sort().join(",");
  return `search:${normalized}`;
}

export async function getCachedCandidates(keywords: string[]): Promise<ImageCandidate[] | null> {
  const cached = await redis.get<ImageCandidate[]>(cacheKey(keywords));
  return cached ?? null;
}

export async function setCachedCandidates(
  keywords: string[],
  candidates: ImageCandidate[]
): Promise<void> {
  await redis.set(cacheKey(keywords), candidates, { ex: CACHE_TTL_SECONDS });
}
