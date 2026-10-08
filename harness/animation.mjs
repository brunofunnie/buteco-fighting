import fs from "node:fs/promises";
import crypto from "node:crypto";
let pw;
try {
  pw = await import("playwright");
} catch {
  pw = await import("/tmp/before-dawn-tools/node_modules/playwright/index.mjs");
}
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const report = { checks: [], inputs: [], screenshots: [], errors: [] };
page.on("pageerror", (e) => report.errors.push(e.message));
await fs.mkdir("artifacts/animation", { recursive: true });
await page.goto("http://127.0.0.1:3187", { waitUntil: "networkidle" });
await page.waitForFunction(
  () => !document.querySelector("#startButton").disabled,
);
await page.locator('#titleStart').click();
await page.locator('[data-mode="versus"]').click();
await page.locator('#fighterNext').click();
await page.locator("#startButton").click();
await page.waitForFunction(() => window.__fight?.fighters.length === 2);
await page.evaluate(() =>
  window.__fight.debugForce({ phase: "fight", cpu: false }),
);
for (const key of [
  "j",
  "k",
  "w",
  "l",
  "s",
  "1",
  "2",
  "ArrowUp",
  "3",
  "ArrowDown",
]) {
  await page.keyboard.down(key);
  await page.waitForTimeout(100);
  report.inputs.push({
    key,
    snapshot: await page.evaluate(() => window.__fight.snapshot()),
  });
  await page.keyboard.up(key);
  await page.waitForTimeout(600);
}
await page.evaluate(() => {
  const g = window.__fight;
  g.paused = true;
  cancelAnimationFrame(g.frame);
  g.freezeForInspection?.();
  g.paused = false;
  g.debugForce({
    phase: "fight",
    fighters: [
      { x: 400, y: 590, facing: 1 },
      { x: 880, y: 590, facing: -1 },
    ],
  });
});
for (const state of [
  "idle",
  "walk",
  "punch",
  "kick",
  "jump",
  "block",
  "crouch",
  "ko",
  "airPunch", "airKick", "crouchPunch", "crouchKick", "uppercut", "sweep", "backwalk", "lowBlock", "turn", "land", "jumpForward",
])
  for (let frame = 0; frame < (["walk","backwalk"].includes(state) ? 6 : 4); frame++) {
    await page.evaluate(
      ({ state, frame }) => {
        const g = window.__fight;
        for (const f of g.fighters) {
          f.state = state;
          f.health = state === "ko" ? 0 : 100;
          f.stun = 0;
          f.action = ["punch", "kick", "airPunch", "airKick", "crouchPunch", "crouchKick", "uppercut", "sweep"].includes(state) ? state : null;
          f.stateTime =
            ["walk","backwalk"].includes(state)
              ? frame / (g.assets[f.id][state]?.animation?.fps || 12)
              : state === "idle"
                ? frame / 6
                : (frame *
                    ({ block: 0.22, crouch: 0.3, ko: 0.65, turn: 0.14, land: 0.11 }[state] || 0.28)) /
                    4 +
                  0.001;
          const tempo = f.id === "maya" ? 0.92 : 1.07;
          const times = {punch:[.11,.2],kick:[.18,.31],airPunch:[.1,.25],airKick:[.14,.32],crouchPunch:[.09,.19],crouchKick:[.14,.29],uppercut:[.12,.35],sweep:[.2,.36]}[state] || [.11,.2];
          const active = times[0] * tempo;
          const end = times[1] * tempo;
          f.actionTime = [0, active * 0.6, active + 0.001, end + 0.001][frame];
          f.vy = -790 + frame * 395 + 1;
          f.y = ["jump", "jumpForward", "airPunch", "airKick"].includes(state) ? 430 : 590;
        }
        g.draw();
      },
      { state, frame },
    );
    const path = `artifacts/animation/${state}-${frame}.png`;
    await page.locator("#gameCanvas").screenshot({ path });
    report.screenshots.push(path);
  }
const metadata = await page.evaluate(() => {
  const g = window.__fight;
  return Object.entries(g.assets).filter(([id]) => ['maya','bruno'].includes(id)).flatMap(([id, states]) =>
    Object.entries(states).flatMap(([state, frames]) =>
      (Array.isArray(frames) ? frames : [frames]).map((img, index) => ({
        id,
        state,
        index,
        pass:
          !!img.spriteMeta &&
          Number.isFinite(img.spriteMeta.scale) &&
          Number.isFinite(img.spriteMeta.anchorX) &&
          Number.isFinite(img.spriteMeta.anchorY),
        meta: img.spriteMeta,
      })),
    ),
  );
});
report.checks.push(
  ...metadata.map((v) => ({ ...v, check: "runtime sprite metadata" })),
);
const sizes = await page.evaluate(() => {
  const g = window.__fight;
  return Object.entries(g.assets).filter(([id]) => ['maya','bruno'].includes(id)).map(([id, a]) => {
    const idle = a.idle[0],
      crouch = a.crouch[3];
    const ib = g.measureSprite(idle),
      cb = g.measureSprite(crouch);
    const height =
      ((320 / (ib.height / idle.naturalHeight)) *
        crouch.spriteMeta.scale *
        cb.height) /
      crouch.naturalHeight;
    return {
      id,
      check: "runtime crouch height",
      height,
      pass: height > 190 && height < 270,
    };
  });
});
report.checks.push(...sizes);
const standingScale = await page.evaluate(() => {
  const g = window.__fight;
  return Object.entries(g.assets).filter(([id]) => ['maya','bruno'].includes(id)).flatMap(([id, states]) =>
    ['idle','punch','kick'].flatMap(state => states[state].map((img,index) => {
      const idle=states.idle[0], ref=g.measureSprite(idle), box=g.measureSprite(img);
      const height=320/(ref.height/idle.naturalHeight)*img.spriteMeta.scale*box.height/img.naturalHeight;
      return {id,state,index,check:'standing pose maintains body scale',height,pass:height>=300 && height<=345};
    })));
});
report.checks.push(...standingScale);

const manifest = JSON.parse(await fs.readFile("assets/manifest.json", "utf8"));
for (const [id, states] of Object.entries(manifest).filter(([id]) => ['maya','bruno'].includes(id))) {
  let count = 0;
  for (const [state, spec] of Object.entries(states)) {
    const hashes = [];
    for (const f of spec.frames) {
      const bytes = await fs.readFile(f.path);
      hashes.push(crypto.createHash("sha256").update(bytes).digest("hex"));
      count++;
      const info = await page.evaluate(async (path) => {
        const img = new Image();
        img.src = path;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let transparent = 0,
          solid = 0;
        for (let i = 3; i < d.length; i += 4) {
          if (d[i] === 0) transparent++;
          if (d[i] > 0) solid++;
        }
        return {
          complete: img.complete,
          width: img.width,
          height: img.height,
          transparent,
          solid,
        };
      }, f.path);
      report.checks.push({
        id,
        state,
        path: f.path,
        pass: info.complete && info.transparent > 0 && info.solid > 0,
        ...info,
      });
    }
    report.checks.push({
      id,
      state,
      check: "animation varies",
      pass: new Set(hashes).size > 1,
    });
  }
  report.checks.push({ id, check: "96 frames", count, pass: count === 96 });
}
await fs.writeFile("artifacts/animation.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    checks: report.checks.length,
    failed: report.checks.filter((c) => !c.pass),
    errors: report.errors,
  }),
);
await browser.close();
if (report.errors.length || report.checks.some((c) => !c.pass))
  process.exitCode = 1;
