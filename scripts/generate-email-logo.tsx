// Renders the white logo used in the header band of every email to
// public/email/logo.png, from the same inline SVG as the app
// (src/components/brand/logo.tsx). Mail clients do not render SVG, hence a
// PNG, drawn at 3x for sharp screens. Run after the logo changes:
//   pnpm exec tsx scripts/generate-email-logo.tsx
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { Logo } from "../src/components/brand/logo";

const HEIGHT = 64;
const SCALE = 3;

const svg = renderToStaticMarkup(<Logo tone="current" />)
  .replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" height="${HEIGHT * SCALE}" style="color:#ffffff" fill="#ffffff" `)
  .replace(/currentColor/g, "#ffffff");

async function main() {
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile("public/email/logo.png");
  const { width, height } = await sharp("public/email/logo.png").metadata();
  console.log(`public/email/logo.png ${width}x${height} (shown at ${Math.round(width / SCALE)}x${HEIGHT})`);
}

void main();
