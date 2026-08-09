import "server-only";
import { callExternalApi } from "@/lib/external-api";
import type { ImageCandidate } from "./types";

type ImgflipMemesResponse = {
  success: boolean;
  data?: { memes: Array<{ url: string; name: string }> };
};

// FR-5: Imgflip's template list is fixed (not keyword-searchable), so this
// checked-alongside-Giphy step just fetches the current popular list and
// leaves relevance judgment to Claude's re-ranking step. No API key required
// for listing (Section 13).
export async function searchImgflip(): Promise<ImageCandidate[]> {
  const data = await callExternalApi("imgflip", async () => {
    const res = await fetch("https://api.imgflip.com/get_memes", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      throw new Error(`Imgflip fetch failed: ${res.status}`);
    }
    return (await res.json()) as ImgflipMemesResponse;
  });

  if (!data.success || !data.data) {
    throw new Error("Imgflip API returned an unsuccessful response");
  }

  return data.data.memes.slice(0, 15).map((meme) => ({
    url: meme.url,
    title: meme.name,
    source: "imgflip" as const,
  }));
}
