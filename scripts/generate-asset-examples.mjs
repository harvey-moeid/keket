import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
).catch(() => {
  throw Error(
    "Install Playwright in a tools directory and set PLAYWRIGHT_MODULE to its index.mjs; see docs/CUSTOM_ASSETS.md.",
  );
});
const origin = process.env.DOCS_ASSET_ORIGIN || "http://127.0.0.1:5173";
const options = {
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
};
if (process.env.CHROMIUM_PATH)
  options.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(options);
const page = await browser.newPage({
  viewport: { width: 2400, height: 3300 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  await page.goto(origin + "/scripts/asset-examples.html");
  await page.waitForFunction(() => window.examplesReady);
  const output = resolve("docs/examples");
  await mkdir(output + "/characters", { recursive: true });
  await mkdir(output + "/arenas", { recursive: true });
  for (const [mode, path] of [
    ["fighter-core", "characters/fighter-core.png"],
    ["fighter-core-guide", "characters/fighter-core-guide.png"],
    ["fighter-all", "characters/fighter-all-actions.png"],
    ["fighter-all-guide", "characters/fighter-all-actions-guide.png"],
    ["arena-background", "arenas/dusk-garden-background.png"],
    ["arena-preview", "arenas/dusk-garden-preview.png"],
    ["arena-guide", "arenas/arena-layout-guide.png"],
    ["arena-atlas", "arenas/arena-props-atlas.png"],
  ]) {
    await page.evaluate((mode) => window.renderExample(mode), mode);
    await page.waitForTimeout(150);
    await page
      .locator("canvas")
      .screenshot({ path: output + "/" + path, omitBackground: true });
  }
  const specs = await page.evaluate(() => window.assetExampleSpecs);
  const baseFPS = {
    idle: 8,
    walk: 12,
    jump: 10,
    light_attack: 15,
    heavy_attack: 12,
    block: 8,
    hit: 12,
    ko: 6,
    victory: 8,
  };
  for (const [name, poses, frames] of [
    ["fighter-core", specs.corePoses, 6],
    ["fighter-all-actions", specs.allPoses, 2],
  ]) {
    const rows = Math.ceil((poses.length * frames) / specs.columns);
    const count = specs.columns * rows;
    const animations = Object.fromEntries(
      poses.map((pose, index) => [
        pose,
        {
          start: index * frames,
          end: index * frames + frames - 1,
          fps: frames === 2 ? 6 : baseFPS[pose] || 10,
        },
      ]),
    );
    const metadata = {
      file: name + ".png",
      frameWidth: specs.frameWidth,
      frameHeight: specs.frameHeight,
      columns: specs.columns,
      rows,
      imageWidth: specs.frameWidth * specs.columns,
      imageHeight: specs.frameHeight * rows,
      margin: 0,
      spacing: 0,
      origin: { x: 0.5, y: 1 },
      facing: "right",
      frameCount: count,
      mappedFrameCount: poses.length * frames,
      unusedFrames: Array.from(
        { length: count - poses.length * frames },
        (_, i) => poses.length * frames + i,
      ),
      animations,
    };
    await writeFile(
      output + "/characters/" + name + ".json",
      JSON.stringify(metadata, null, 2) + "\n",
    );
    const entries = poses.flatMap((pose, index) =>
      Array.from({ length: frames }, (_, phase) => {
        const frame = index * frames + phase;
        return `${frame},${Math.floor(frame / specs.columns)},${frame % specs.columns},${pose},${phase}`;
      }),
    );
    await writeFile(
      output + "/characters/" + name + "-frames.csv",
      "index,row,column,animation,phase\n" + entries.join("\n") + "\n",
    );
  }
  if (errors.length) throw Error(errors.join("\n"));
  console.log(
    "8 asset examples and character mapping JSON/CSV exported from the game rig; no backend changes.",
  );
} finally {
  await browser.close();
}
