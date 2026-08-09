import "server-only";

// R10/Audit 2: candidate image URLs come from third-party API responses
// (Giphy, Imgflip) or our own Blob storage — never directly from raw user
// input — but they're still "external" from this server's point of view.
// Allowlist the hosts we ever expect, rather than fetching any URL a
// third-party response happens to contain.
const ALLOWED_IMAGE_HOSTS = [
  "media.giphy.com",
  "media0.giphy.com",
  "media1.giphy.com",
  "media2.giphy.com",
  "media3.giphy.com",
  "media4.giphy.com",
  "i.imgflip.com",
  "public.blob.vercel-storage.com",
];

export function assertSafeImageUrl(rawUrl: string): void {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:") {
    throw new Error(`Refusing to fetch non-https image URL: ${rawUrl}`);
  }
  const isAllowed = ALLOWED_IMAGE_HOSTS.some(
    (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
  );
  if (!isAllowed) {
    throw new Error(`Refusing to fetch image from unrecognized host: ${url.hostname}`);
  }
}
