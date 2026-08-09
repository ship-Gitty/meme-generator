import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { callExternalApi } from "@/lib/external-api";
import type { ImageCandidate } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Cheapest/fastest tier — keyword extraction, captioning, and re-ranking are
// all simple enough tasks that a top-tier model isn't needed, and SPEC.md
// treats API cost as a first-class concern from Phase 1 onward (R2/R13).
const MODEL = "claude-haiku-4-5-20251001";

function firstToolInput<T>(message: Anthropic.Message): T {
  const block = message.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") {
    throw new Error("Claude did not return the expected tool call");
  }
  return block.input as T;
}

// FR-4: prompt -> keywords + caption. Keyword extraction is mandatory before
// any image search — never search the raw user prompt directly (Recommended
// Technical Decision #1).
export async function extractKeywordsAndCaption(
  prompt: string
): Promise<{ keywords: string[]; caption: string }> {
  const message = await callExternalApi("claude", () =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      tools: [
        {
          name: "meme_brief",
          description:
            "Extract image search keywords and write a meme caption for the given prompt.",
          input_schema: {
            type: "object",
            properties: {
              keywords: {
                type: "array",
                items: { type: "string" },
                description:
                  "3-6 short keywords/phrases to search an image/GIF library with, derived from the prompt's subject and emotion.",
              },
              caption: {
                type: "string",
                description:
                  "A short, funny meme caption (under 100 characters) based on the prompt. No surrounding quotation marks.",
              },
            },
            required: ["keywords", "caption"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "meme_brief" },
      messages: [{ role: "user", content: `Meme prompt: "${prompt}"` }],
    })
  );

  return firstToolInput<{ keywords: string[]; caption: string }>(message);
}

// FR-5: re-rank Giphy/Imgflip candidates against the original prompt instead
// of trusting raw keyword search (Design Decision, Section 15).
export async function rerankCandidates(
  prompt: string,
  candidates: ImageCandidate[]
): Promise<{ bestIndex: number | null; confidence: number }> {
  if (candidates.length === 0) {
    return { bestIndex: null, confidence: 0 };
  }

  const message = await callExternalApi("claude", () =>
    anthropic.messages.create({
      model: MODEL,
      max_tokens: 200,
      tools: [
        {
          name: "pick_best_candidate",
          description:
            "Pick the image/GIF candidate that best matches the meme prompt, or none if none fit well.",
          input_schema: {
            type: "object",
            properties: {
              best_index: {
                type: ["integer", "null"],
                description:
                  "0-based index of the best-matching candidate, or null if none score well enough.",
              },
              confidence: {
                type: "number",
                description: "Confidence in the chosen match, 0 to 1. 0 if best_index is null.",
              },
            },
            required: ["best_index", "confidence"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "pick_best_candidate" },
      messages: [
        {
          role: "user",
          content: `Original meme prompt: "${prompt}"\n\nCandidates:\n${candidates
            .map((c, i) => `${i}. ${c.title ?? "(untitled)"} — ${c.url}`)
            .join("\n")}\n\nPick the single best match, or none if none are a good fit.`,
        },
      ],
    })
  );

  const input = firstToolInput<{ best_index: number | null; confidence: number }>(message);
  return { bestIndex: input.best_index, confidence: input.confidence };
}
