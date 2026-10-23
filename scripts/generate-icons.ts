// Draws the app icon and writes every file browsers and phones ask for. Run `pnpm icons` after changing it.
import { mkdirSync, writeFileSync } from "node:fs";

import { chromium } from "@playwright/test";

// The icon-green role from docs/ui/design-system.md as hex (an image file cannot read the SCSS tokens): Oppo's bright
// green, which white letters on it clear at 3.67:1 as a graphic
const accent = "#189a30";
const onAccent = "#ffffff";

// Lowercase pn drawn as strokes, in units where the x-height is 180: p is a stem and a bowl, n a stem and an arch
const letters = {
  width: 388,
  height: 252,
  paths:
    `<path d="M20 0V252"/><circle cx="90" cy="90" r="70"/>` +
    `<path d="M228 0V180"/><path d="M228 90A70 70 0 0 1 368 90V180"/>`,
};

// Scaled and centred so the p's stem ends, the farthest points, stay inside the maskable safe zone (radius 40%)
const scale = 0.84;
const offsetX = ((512 - letters.width * scale) / 2).toFixed(2);
const offsetY = ((512 - letters.height * scale) / 2).toFixed(2);
const mark =
  `<g fill="none" stroke="${onAccent}" stroke-width="40" ` +
  `transform="translate(${offsetX} ${offsetY}) scale(${scale})">${letters.paths}</g>`;

type Shape = "rounded" | "square";

// Rounded where the icon is shown as drawn; square where the phone cuts its own shape out of it
function icon(shape: Shape) {
  const corners = shape === "rounded" ? ' rx="112"' : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
    `<rect width="512" height="512"${corners} fill="${accent}"/>${mark}</svg>\n`
  );
}

const pngs = [
  { path: "public/icons/icon-192.png", size: 192, shape: "rounded" },
  { path: "public/icons/icon-512.png", size: 512, shape: "rounded" },
  { path: "public/icons/icon-maskable-512.png", size: 512, shape: "square" },
  { path: "src/app/apple-icon.png", size: 180, shape: "square" },
] as const satisfies ReadonlyArray<{ path: string; size: number; shape: Shape }>;

writeFileSync("src/app/icon.svg", icon("rounded"));
mkdirSync("public/icons", { recursive: true });

const browser = await chromium.launch({ channel: "chromium" });
await Promise.all(
  pngs.map(async ({ path, size, shape }) => {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${icon(shape)}`,
    );
    await page.screenshot({ path, omitBackground: true });
  }),
);
await browser.close();
