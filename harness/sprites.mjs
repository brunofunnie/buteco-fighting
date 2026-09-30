import { readFile, writeFile, readdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { fighterIds } from "../roster.js";

// Publish only sprite-gen's curated exports; extraction cache is not a game asset.
const manifest = {};
for (const character of fighterIds) {
  const assetName = { maya: "rina-sabre", bruno: "waggy" }[character] || character;
  const root = `assets/sprites/${assetName}`;
  const request = JSON.parse(
    await readFile(join(root, "sprite-request.json"), "utf8"),
  );
  const files = await readdir(join(root, "curated"));
  const metrics = JSON.parse(
    await readFile(join(root, "runtime-metrics.json"), "utf8"),
  );
  manifest[character] = {};
  for (const [state, spec] of Object.entries(request.states)) {
    const frames = files
      .filter((file) => file.startsWith(`${state}-`) && file.endsWith(".png"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (frames.length !== spec.frames)
      throw new Error(
        `${character}/${state}: expected ${spec.frames}, found ${frames.length}`,
      );
    manifest[character][state] = {
      frames: metrics[state].map(({ path, scale, anchorX, anchorY }) => ({
        path,
        scale,
        anchorX,
        anchorY,
      })),
      fps: spec.fps,
      loop: spec.loop,
    };
  }
}
await writeFile("assets/manifest.json.tmp", JSON.stringify(manifest, null, 2) + "\n");
await rename("assets/manifest.json.tmp", "assets/manifest.json");
console.log("Published assets/manifest.json");
