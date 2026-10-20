// Clash Display may be self-hosted but not redistributed through a repository
// (ITF Free Font License, section 02), so its files are fetched from Fontshare
// before dev and build instead of living in git.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const CSS = "https://api.fontshare.com/v2/css?f[]=clash-display@500,600&display=swap";
const FILES = { 500: "ClashDisplay-Medium.woff2", 600: "ClashDisplay-Semibold.woff2" };
const dir = new URL("../src/fonts/", import.meta.url);

const missing = Object.entries(FILES).filter(([, name]) => !existsSync(new URL(name, dir)));
if (missing.length > 0) {
  const css = await (await fetch(CSS)).text();
  for (const [weight, name] of missing) {
    const face = css
      .split("@font-face")
      .find((block) => block.includes("'Clash Display'") && block.includes(`font-weight: ${weight};`));
    const src = face && /url\('([^']+\.woff2)'\)/.exec(face)?.[1];
    if (!src) throw new Error(`Fontshare has no Clash Display ${weight} woff2`);
    const res = await fetch(new URL(src, "https://cdn.fontshare.com"));
    if (!res.ok) throw new Error(`${name}: ${res.status}`);
    await writeFile(new URL(name, dir), Buffer.from(await res.arrayBuffer()));
    console.log(`fetched ${name}`);
  }
}
