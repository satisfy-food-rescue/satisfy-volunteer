// Renders the app icon, the iOS 26 Icon Composer bundle, Android adaptive
// icon layers and the splash image from the brand vector paths, so the store
// assets always match the logo.
// Run from the repo root (it borrows sharp from the web workspace):
//   node mobile/scripts/generate-icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require(fileURLToPath(new URL("../../node_modules/sharp", import.meta.url)));

const paths = readFileSync(new URL("../src/components/brand/paths.ts", import.meta.url), "utf8");
const list = (name) => [...paths.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const one = (name) => paths.match(new RegExp(`export const ${name} = "([^"]+)"`))[1];
const ICON = list("ICON");
const LOGO = [...ICON, ...list("WORDMARK"), ...list("TAGLINE"), one("SMILE")];

const TEAL = "#106379";
const out = (file) => fileURLToPath(new URL(`../assets/images/${file}`, import.meta.url));
const g = (ds, fill) => `<g fill="${fill}">${ds.map((d) => `<path d="${d}"/>`).join("")}</g>`;

// The produce-and-cutlery icon spans x 40.4..69 and y -0.4..26.3 in logo units.
function glyph(size, scale, fill) {
  const w = 28.6 * scale;
  const h = 26.7 * scale;
  const x = (size - w) / 2 - 40.4 * scale;
  const y = (size - h) / 2 + 0.4 * scale;
  return `<g transform="translate(${x} ${y}) scale(${scale})">${g(ICON, fill)}</g>`;
}

async function png(svg, file) {
  await sharp(Buffer.from(svg)).png().toFile(out(file));
  console.log("wrote", file);
}

const S = 1024;
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="${TEAL}"/>${glyph(S, 23, "#ffffff")}</svg>`, "icon.png");
// Adaptive icons crop to a circle inside the middle 66%, so the glyph is smaller.
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${glyph(S, 16, "#ffffff")}</svg>`, "android-icon-foreground.png");
await png(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${glyph(S, 16, "#000000")}</svg>`, "android-icon-monochrome.png");
// Splash: the full stacked logo in white on the teal background colour.
const L = 1200;
const scale = (L * 0.9) / 110.23;
await png(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}"><g transform="translate(${(L - 110.23 * scale) / 2} ${(L - 105.69 * scale) / 2}) scale(${scale})">${g(LOGO, "#ffffff")}</g></svg>`,
  "splash-icon.png",
);

// iOS 26 Liquid Glass icon: a white glyph layer on a solid teal fill.
const bundle = fileURLToPath(new URL("../assets/satisfy.icon", import.meta.url));
mkdirSync(`${bundle}/Assets`, { recursive: true });
writeFileSync(`${bundle}/Assets/glyph.svg`, `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${glyph(S, 23, "#ffffff")}</svg>\n`);
const [r, gr, b] = [1, 3, 5].map((i) => (parseInt(TEAL.slice(i, i + 2), 16) / 255).toFixed(5));
const iconJson = {
  fill: { solid: `srgb:${r},${gr},${b},1.00000` },
  groups: [{ layers: [{ "image-name": "glyph.svg", name: "glyph" }], shadow: { kind: "neutral", opacity: 0.5 }, translucency: { enabled: true, value: 0.4 } }],
  "supported-platforms": { circles: ["watchOS"], squares: "shared" },
};
writeFileSync(`${bundle}/icon.json`, JSON.stringify(iconJson, null, 2) + "\n");
console.log("wrote satisfy.icon");
