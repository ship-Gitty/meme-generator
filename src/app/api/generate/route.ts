import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateRateLimit } from "@/lib/rate-limit";
import { extractKeywordsAndCaption, rerankCandidates } from "@/lib/generation/claude";
import { getCuratedTemplates } from "@/lib/generation/templates";
import { getCachedCandidates, setCachedCandidates } from "@/lib/generation/search-cache";
import { searchGiphy } from "@/lib/generation/giphy";
import { searchImgflip } from "@/lib/generation/imgflip";
import { generateFallbackImage } from "@/lib/generation/gemini";
import { isCaptionSafe } from "@/lib/generation/moderation";
import { renderMeme } from "@/lib/generation/render";
import type { ImageCandidate } from "@/lib/generation/types";

const MAX_PROMPT_LENGTH = 500;
// R1/R2: confidence threshold gating the Gemini fallback — a starting point,
// tune against real fallback-trigger rate rather than guessing (R2's stated
// approach), see docs/PHASES.md.
const CONFIDENCE_THRESHOLD = 0.6;

// FR-3 through FR-8: the core generation pipeline. Auth-checked (FR-1 scope
// extends here per NFR-3/NFR-11 — enforced at the API layer, not just via
// proxy.ts), per-user rate limited (NFR-6), returns a draft without
// persisting it (FR-8; saving is Phase 3).
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { success: withinLimit } = await generateRateLimit.limit(session.user.id);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again in a minute." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = (body as { prompt?: unknown } | null)?.prompt;
  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `prompt must be ${MAX_PROMPT_LENGTH} characters or fewer` },
      { status: 400 }
    );
  }

  try {
    // FR-4: keyword extraction is mandatory before any image search — never
    // search the raw prompt directly.
    const { keywords, caption } = await extractKeywordsAndCaption(prompt);

    // FR-19: screen the caption before it's ever rendered. If moderation is
    // unavailable, hold the caption rather than render it unscreened
    // (Section 13's stated failure-handling policy).
    let captionSafe: boolean;
    try {
      captionSafe = await isCaptionSafe(caption);
    } catch {
      return NextResponse.json(
        { error: "Content moderation is temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }
    if (!captionSafe) {
      return NextResponse.json(
        { error: "The generated caption didn't pass content moderation. Try a different prompt." },
        { status: 422 }
      );
    }

    // R1/R13: curated library first, then cache, then live search.
    const curated = await getCuratedTemplates();

    let liveOrCached: ImageCandidate[];
    let fromCache = false;
    const cached = await getCachedCandidates(keywords);
    if (cached) {
      liveOrCached = cached;
      fromCache = true;
    } else {
      const [giphyResult, imgflipResult] = await Promise.allSettled([
        searchGiphy(keywords),
        searchImgflip(),
      ]);
      liveOrCached = [
        ...(giphyResult.status === "fulfilled" ? giphyResult.value : []),
        ...(imgflipResult.status === "fulfilled" ? imgflipResult.value : []),
      ];
      if (liveOrCached.length > 0) {
        await setCachedCandidates(keywords, liveOrCached);
      }
    }

    const candidates = [...curated, ...liveOrCached];

    // FR-5: re-rank against the original prompt rather than trusting raw
    // keyword search.
    const { bestIndex, confidence } = await rerankCandidates(prompt, candidates);

    let imageSource: string | Buffer;
    let sourceType: "static" | "animated";
    let usedFallback = false;

    const chosen = bestIndex !== null ? candidates[bestIndex] : undefined;
    if (chosen && confidence >= CONFIDENCE_THRESHOLD) {
      imageSource = chosen.url;
      sourceType = chosen.source === "giphy" ? "animated" : "static";
    } else {
      // FR-6: Gemini fallback only when no candidate scores well.
      imageSource = await generateFallbackImage(prompt);
      sourceType = "static";
      usedFallback = true;
    }

    // FR-7: render module composites the caption onto the chosen image.
    const { buffer, fontSize } = await renderMeme(imageSource, caption);
    const imageDataUrl = `data:image/png;base64,${buffer.toString("base64")}`;

    // FR-8: draft returned to the browser, not yet persisted — saving is
    // Phase 3's job.
    return NextResponse.json({
      prompt,
      caption,
      keywords,
      sourceType,
      usedFallback,
      fromCache,
      imageDataUrl,
      textStyle: {
        color: "#ffffff",
        weight: "bold",
        size: fontSize,
        position: "bottom",
      },
    });
  } catch (err) {
    console.error("Generation pipeline failed:", err);
    return NextResponse.json(
      { error: "Something went wrong generating your meme. Please try again." },
      { status: 502 }
    );
  }
}
