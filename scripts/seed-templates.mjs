// One-time (re-runnable) script to seed the curated template library.
// Usage: node scripts/seed-templates.mjs
// After it finishes, copy the printed manifest URL into .env.local as
// TEMPLATES_MANIFEST_URL.
import { put } from "@vercel/blob";

process.loadEnvFile(".env.local");

const TEMPLATE_COUNT = 40;

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const res = await fetch("https://api.imgflip.com/get_memes");
  const data = await res.json();
  if (!data.success) {
    throw new Error("Imgflip get_memes request failed");
  }

  const templates = data.data.memes.slice(0, TEMPLATE_COUNT);
  const manifest = [];

  for (const template of templates) {
    const imageRes = await fetch(template.url);
    if (!imageRes.ok) {
      console.warn(`Skipping "${template.name}": fetch failed (${imageRes.status})`);
      continue;
    }
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const ext = template.url.split(".").pop() ?? "jpg";
    const slug = slugify(template.name);

    const blob = await put(`templates/${slug}.${ext}`, buffer, {
      access: "public",
      allowOverwrite: true,
      contentType: imageRes.headers.get("content-type") ?? undefined,
    });

    manifest.push({ name: template.name, url: blob.url });
    console.log(`Seeded: ${template.name}`);
  }

  const manifestBlob = await put("templates/manifest.json", JSON.stringify(manifest, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });

  console.log(`\nDone. Seeded ${manifest.length} templates.`);
  console.log(`Add this to .env.local:\nTEMPLATES_MANIFEST_URL=${manifestBlob.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
