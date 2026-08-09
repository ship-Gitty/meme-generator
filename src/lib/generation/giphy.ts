import "server-only";
import { callExternalApi } from "@/lib/external-api";
import type { ImageCandidate } from "./types";

type GiphySearchResponse = {
  data: Array<{ title?: string; images?: { original?: { url?: string } } }>;
};

// FR-5: search Giphy using derived keywords (never the raw prompt).
export async function searchGiphy(keywords: string[]): Promise<ImageCandidate[]> {
  const url = new URL("https://api.giphy.com/v1/gifs/search");
  url.searchParams.set("api_key", process.env.GIPHY_API_KEY!);
  url.searchParams.set("q", keywords.join(" "));
  url.searchParams.set("limit", "10");
  url.searchParams.set("rating", "pg-13");

  const data = await callExternalApi("giphy", async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      throw new Error(`Giphy search failed: ${res.status}`);
    }
    return (await res.json()) as GiphySearchResponse;
  });

  const candidates: ImageCandidate[] = [];
  for (const gif of data.data) {
    const url = gif.images?.original?.url;
    if (url) {
      candidates.push({ url, title: gif.title, source: "giphy" });
    }
  }
  return candidates;
}
