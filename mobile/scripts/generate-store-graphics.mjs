// Renders the Google Play feature graphic and frames the raw screenshots
// into listing images with a headline: Android captures
// (store-screenshots/android/raw, 1080x2400 from the emulator) into 9:16
// Play images, and iPhone captures (store-screenshots/ios/raw/<size>, from
// the simulator) into App Store images of the same size.
// Run from the repo root (it borrows Playwright and sharp from the web
// workspace, and Montserrat from the app):
//   node mobile/scripts/generate-store-graphics.mjs
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = (p) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const app = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const sharp = require(root("node_modules/sharp"));
const { chromium } = require(root("node_modules/playwright"));

const paths = readFileSync(app("src/components/brand/paths.ts"), "utf8");
const list = (name) => [...paths.match(new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`))[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const one = (name) => paths.match(new RegExp(`export const ${name} = "([^"]+)"`))[1];
const wave = (name) => paths.match(new RegExp(`  ${name}: "([^"]+)"`))[1];
const LOGO = [...list("ICON"), ...list("WORDMARK"), ...list("TAGLINE"), one("SMILE")];

// Brand colours from src/theme.ts.
const C = { teal: "#106379", tealDeep: "#0b4a5b", tealOn: "#b8e3c4", orange: "#e08c3c", green: "#40bb6a" };

const font = (weight, file) => {
  const data = readFileSync(app(`node_modules/@expo-google-fonts/montserrat/${file}/Montserrat_${file}.ttf`)).toString("base64");
  return `@font-face { font-family: Montserrat; font-weight: ${weight}; src: url(data:font/ttf;base64,${data}); }`;
};
const css = `${font(500, "500Medium")}${font(700, "700Bold")}
  * { margin: 0; box-sizing: border-box; }
  body { font-family: Montserrat; background: ${C.teal}; overflow: hidden; position: relative; -webkit-font-smoothing: antialiased; }
  h1 { color: #fff; font-weight: 700; letter-spacing: -0.01em; }
  p { color: ${C.tealOn}; font-weight: 500; }`;

const logo = (height) =>
  `<svg height="${height}" viewBox="0 0 110.23 105.69" style="display:block"><g fill="#fff">${LOGO.map((d) => `<path d="${d}"/>`).join("")}</g></svg>`;
// The brand ribbons, stretched across the bottom as on the App Store set.
const waves = (style) =>
  `<svg viewBox="0 0 482 47" preserveAspectRatio="none" style="position:absolute;${style}">
    <path d="${wave("orange")}" fill="${C.orange}"/>
    <path d="${wave("teal")}" fill="${C.tealDeep}" opacity="0.85"/>
    <path d="${wave("green")}" fill="${C.green}"/>
  </svg>`;

const out = app("store-screenshots/android");
const ios = app("store-screenshots/ios");
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(html, width, height, file, dir = out) {
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body style="width:${width}px;height:${height}px">${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  // Play wants 24-bit PNGs: no alpha channel.
  // The App Store takes no alpha channel either.
  await sharp(await page.screenshot({ type: "png" })).removeAlpha().png({ compressionLevel: 9 }).toFile(`${dir}/${file}`);
  console.log("wrote", file);
}

// Feature graphic: 1024x500. Play may overlay a play button in the middle and
// crops nothing, but keeps the important parts away from the edges.
await render(
  `${waves("left:-40px;right:-40px;bottom:-34px;height:150px")}
  <div style="position:absolute;inset:0 0 70px;display:flex;align-items:center;gap:64px;padding:0 88px">
    ${logo(232)}
    <div>
      <h1 style="font-size:60px;line-height:1.08">Satisfy<br>Volunteers</h1>
      <p style="font-size:26px;line-height:1.4;margin-top:20px;max-width:520px">Book shifts, cover a gap and keep your training current.</p>
    </div>
  </div>`,
  1024,
  500,
  "feature-graphic.png",
);

// Phone screenshots: 1440x2560 (9:16), the 1080x2400 capture in a phone frame.
const CAPTIONS = {
  "01-home": ["Your next shift,<br>at a glance", "When you’re on, where, and<br>who you’re working with."],
  "02-shifts": ["Book shifts that<br>fit your week", "Browse the roster and grab<br>a spot in a couple of taps."],
  "03-cover": ["Step in when<br>someone’s away", "See who’s away and cover<br>their shift in one tap."],
  "04-training": ["Your training,<br>always current", "See what’s done and what’s<br>due before it blocks a shift."],
  "05-refresher": ["Refreshers you<br>can do anywhere", "Read, confirm, and you’re<br>set for another year."],
  "06-away": ["Away? Tell the<br>team in seconds", "Your shifts go out for cover.<br>Your slot is back when you are."],
  "07-harvest": ["Join the<br>harvest pool", "Pick fruit from local orchards<br>in summer and autumn."],
};
const W = 1440;
const H = 2560;
const screenH = 1800;
const screenW = (screenH * 1080) / 2400;
const bezel = 22;
mkdirSync(`${out}/phone`, { recursive: true });
for (const file of readdirSync(`${out}/raw`).filter((f) => f.endsWith(".png")).sort()) {
  const name = file.replace(/\.png$/, "");
  const [title, sub] = CAPTIONS[name] ?? [];
  if (!title) throw new Error(`No caption for raw/${file}`);
  const shot = readFileSync(`${out}/raw/${file}`).toString("base64");
  await render(
    `${waves(`left:-120px;right:-120px;bottom:-40px;height:${H * 0.24}px`)}
    <div style="position:absolute;top:150px;left:0;right:0;text-align:center">
      <h1 style="font-size:100px;line-height:1.12">${title}</h1>
      <p style="font-size:46px;line-height:1.38;margin-top:34px">${sub}</p>
    </div>
    <div style="position:absolute;left:${(W - screenW) / 2 - bezel}px;bottom:${H - 640 - screenH - 2 * bezel}px;padding:${bezel}px;border-radius:${screenW * 0.07 + bezel}px;
      background:#0d1a1f;box-shadow:0 0 0 3px #2a3a40 inset,0 40px 90px rgba(0,0,0,0.35)">
      <img src="data:image/png;base64,${shot}" style="display:block;width:${screenW}px;height:${screenH}px;border-radius:${screenW * 0.07}px">
      <div style="position:absolute;top:${bezel + 10}px;left:50%;width:30px;height:30px;margin-left:-15px;border-radius:50%;background:#0d1a1f"></div>
    </div>`,
    W,
    H,
    `phone/${file}`,
  );
}

// App Store screenshots: the simulator capture in an iPhone frame, at the
// capture's own size (6.9" 1320x2868, 6.3" 1206x2622). Laid out for 1320
// wide and scaled for the smaller phone.
for (const size of readdirSync(`${ios}/raw`).filter((d) => statSync(`${ios}/raw/${d}`).isDirectory()).sort()) {
  mkdirSync(`${ios}/${size}`, { recursive: true });
  for (const file of readdirSync(`${ios}/raw/${size}`).filter((f) => f.endsWith(".png")).sort()) {
    const name = file.replace(/\.png$/, "");
    const [title, sub] = CAPTIONS[name] ?? [];
    if (!title) throw new Error(`No caption for ios/raw/${size}/${file}`);
    const raw = `${ios}/raw/${size}/${file}`;
    const { width, height } = await sharp(raw).metadata();
    const k = width / 1320;
    const sw = 960 * k;
    const sh = (sw * height) / width;
    const b = 20 * k;
    // The screen's corners and the Dynamic Island, which a simulator
    // capture leaves out, in proportion to the 440pt-wide phone.
    const pt = sw / 440;
    const shot = readFileSync(raw).toString("base64");
    await render(
      `${waves(`left:-110px;right:-110px;bottom:-40px;height:${height * 0.24}px`)}
      <div style="position:absolute;top:${150 * k}px;left:0;right:0;text-align:center">
        <h1 style="font-size:${96 * k}px;line-height:1.1">${title}</h1>
        <p style="font-size:${44 * k}px;line-height:1.36;margin-top:${30 * k}px">${sub}</p>
      </div>
      <div style="position:absolute;left:${(width - sw) / 2 - b}px;bottom:${110 * k}px;padding:${b}px;border-radius:${55 * pt + b}px;
        background:#0d1a1f;box-shadow:0 0 0 ${3 * k}px #2a3a40 inset,0 40px 90px rgba(0,0,0,0.35)">
        <img src="data:image/png;base64,${shot}" style="display:block;width:${sw}px;height:${sh}px;border-radius:${55 * pt}px">
        <div style="position:absolute;top:${b + 11 * pt}px;left:50%;width:${126 * pt}px;height:${37 * pt}px;margin-left:${-63 * pt}px;border-radius:${18.5 * pt}px;background:#000"></div>
      </div>`,
      width,
      height,
      `${size}/${file}`,
      ios,
    );
  }
}

await browser.close();

// Check every listing graphic against Google Play's rules before upload.
const rules = [
  ["icon-512.png", (m) => m.width === 512 && m.height === 512 && m.channels === 4 && m.size <= 1024 ** 2, "512x512 32-bit PNG, up to 1 MB"],
  ["feature-graphic.png", (m) => m.width === 1024 && m.height === 500 && m.channels === 3 && m.size <= 15 * 1024 ** 2, "1024x500 24-bit PNG, up to 15 MB"],
];
const phone = readdirSync(`${out}/phone`).filter((f) => f.endsWith(".png"));
if (phone.length < 2) throw new Error("Google Play needs at least 2 phone screenshots");
for (const f of phone) {
  const ok = (m) => m.width * 16 === m.height * 9 && Math.min(m.width, m.height) >= 320 && Math.max(m.width, m.height) <= 3840 && m.channels === 3 && m.size <= 8 * 1024 ** 2;
  rules.push([`phone/${f}`, ok, "9:16, each side 320-3840 px, 24-bit PNG, up to 8 MB"]);
}
for (const [file, ok, rule] of rules) {
  const m = { ...(await sharp(`${out}/${file}`).metadata()), size: statSync(`${out}/${file}`).size };
  if (!ok(m)) throw new Error(`${file} is ${m.width}x${m.height}, ${m.channels} channels, ${m.size} bytes; Play wants ${rule}`);
  console.log(`ok ${file}: ${m.width}x${m.height}, ${m.channels * 8}-bit, ${Math.round(m.size / 1024)} KB`);
}

// And the App Store set: each image the size of its capture, with no alpha.
const APP_STORE = { "6.9-inch": [1320, 2868], "6.3-inch": [1206, 2622] };
for (const [size, [w, h]] of Object.entries(APP_STORE)) {
  for (const f of readdirSync(`${ios}/${size}`).filter((f) => f.endsWith(".png"))) {
    const m = await sharp(`${ios}/${size}/${f}`).metadata();
    if (m.width !== w || m.height !== h || m.channels !== 3) throw new Error(`ios/${size}/${f} is ${m.width}x${m.height}, ${m.channels} channels; the App Store wants ${w}x${h} without alpha`);
    console.log(`ok ios/${size}/${f}: ${m.width}x${m.height}`);
  }
}
