import "server-only";
import path from "node:path";
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { assertSafeImageUrl } from "./safe-fetch";

const FONT_PATH = path.join(process.cwd(), "src/lib/generation/fonts/Anton-Regular.ttf");
const FONT_FAMILY = "Anton";

let fontRegistered = false;
function ensureFontRegistered() {
  if (!fontRegistered) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    fontRegistered = true;
  }
}

function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

// FR-7: composite caption onto image as the initial draft — Impact-style
// font (Anton, an open-license Impact-alike; real Impact isn't guaranteed to
// exist on a serverless Linux container), white fill, black outline, bottom
// placement by default (position becomes user-editable in Phase 3, FR-10).
export async function renderMeme(
  imageSource: string | Buffer,
  caption: string
): Promise<{ buffer: Buffer; fontSize: number }> {
  ensureFontRegistered();

  if (typeof imageSource === "string") {
    assertSafeImageUrl(imageSource);
  }

  const image = await loadImage(imageSource);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(image, 0, 0, image.width, image.height);

  const fontSize = Math.max(24, Math.round(image.width / 12));
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = Math.max(2, Math.round(fontSize / 10));

  const maxWidth = image.width * 0.9;
  const lines = wrapText(ctx, caption.toUpperCase(), maxWidth);
  const lineHeight = fontSize * 1.15;
  const bottomPadding = fontSize * 0.4;
  const x = image.width / 2;

  [...lines].reverse().forEach((line, i) => {
    const y = image.height - bottomPadding - i * lineHeight;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });

  return { buffer: canvas.toBuffer("image/png"), fontSize };
}
