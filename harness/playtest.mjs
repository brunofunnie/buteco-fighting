import fs from "node:fs/promises";
let playwright;
try {
  playwright = await import("playwright");
} catch {
  playwright =
    await import("/tmp/before-dawn-tools/node_modules/playwright/index.mjs");
}
const browser = await playwright.chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const report = { checks: [], errors: [], screenshots: [] };
page.on("pageerror", (error) => report.errors.push(error.message));
const check = (name, pass, details) =>
  report.checks.push({ name, pass: !!pass, details });
const snap = () => page.evaluate(() => window.__fight.snapshot());
const force = (values) =>
  page.evaluate((values) => window.__fight.debugForce(values), values);
const capture = async (name) => {
  const path = `artifacts/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  report.screenshots.push(path);
};
const press = async (key, duration = 50) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(duration);
  await page.keyboard.up(key);
};
const readyFight = async () => {
  await page.waitForFunction(() => window.__fight?.fighters?.length === 2);
  await force({ phase: "fight" });
};
const openSelection = async () => {
  if (await page.locator('#titleStart').isVisible()) await page.locator('#titleStart').click();
};
const setup = async (mode = "versus", stage = 0) => {
  await openSelection();
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator('#modeNext').click();
  await page.locator('#fighterNext').click();
  await page.locator(`[data-stage="${stage}"]`).click();
  await page.locator("#startButton").click();
  await readyFight();
};
const menu = async () => {
  await page.locator("#pauseButton").click();
  await page.locator("#menuButton").click();
};
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:3187", {
    waitUntil: "networkidle",
  });
  await page.locator("#titleStart").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector("#startButton").disabled,
  );
  await capture("title-v2");
  await openSelection();
  await page.locator('#modeNext').click();
  await capture("fighter-menu-v2");
  await page.locator('[data-player="bruno"]').click();
  check(
    "character selection",
    (await page
      .locator('[data-player="bruno"]')
      .getAttribute("aria-pressed")) === "true",
  );
  await capture("selection");
  await page.locator('#backButton').click();
  await setup();
  check(
    "selected character starts match",
    (await snap()).fighters[0].id === "bruno",
  );
  await capture("stage-0");
  const before = await snap();
  await press("d", 250);
  const moved = await snap();
  check("keyboard movement", moved.fighters[0].x > before.fighters[0].x + 30, {
    before,
    after: moved,
  });
  await press("w", 60);
  check("keyboard jump", (await snap()).fighters[0].y < 585);
  await page.waitForTimeout(1000);
  const reset = async (gap = 100) =>
    force({
      phase: "fight",
      energy: 100,
      fighters: [
        { x: 500, y: 590, health: 100, action: null, stun: 0 },
        { x: 500 + gap, y: 590, health: 100, action: null, stun: 0 },
      ],
    });
  for (const [key, name] of [
    ["j", "keyboard punch"],
    ["k", "keyboard kick"],
  ]) {
    await reset();
    await press(key);
    await page.waitForTimeout(600);
    const after = await snap();
    check(name, after.fighters[1].health < 100, after);
  }
  await reset();
  await page.keyboard.down("3");
  await page.waitForTimeout(80);
  await press("j");
  await page.waitForTimeout(500);
  await page.keyboard.up("3");
  const blocked = await snap();
  check(
    "defense reduces punch damage",
    blocked.fighters[1].health > 98 && blocked.fighters[1].health < 100,
    blocked,
  );
  await reset();
  await page.keyboard.down("ArrowDown");
  await page.keyboard.down("3");
  await page.waitForTimeout(100);
  const lowGuard = await snap();
  check(
    "crouching defense keeps low posture",
    lowGuard.fighters[1].guard && lowGuard.fighters[1].state === "lowBlock",
    lowGuard,
  );
  await page.keyboard.up("3");
  await page.keyboard.up("ArrowDown");
  await reset(350);
  await press("u");
  await page.waitForTimeout(900);
  const special = await snap();
  check(
    "special damages and consumes energy",
    special.fighters[1].health < 100 && special.fighters[0].energy < 100,
    special,
  );
  await reset(350);
  await press("i");
  await page.waitForTimeout(900);
  const superMove = await snap();
  check(
    "super consumes full meter and causes heavy damage",
    superMove.fighters[0].energy === 0 && superMove.fighters[1].health <= 68,
    superMove,
  );
  check("Phaser scene owns game lifecycle", await page.evaluate(() => window.__phaser?.scene?.isActive('Arena')));
  for (const [modifier, key, state] of [
    ['s','j','crouchPunch'],['s','k','crouchKick'],['s','u','uppercut'],['s','i','sweep'],
    ['w','j','airPunch'],['w','k','airKick'],
  ]) {
    await reset(200);
    await page.keyboard.down(modifier);
    await page.waitForTimeout(35);
    await press(key, 45);
    const action = await snap();
    check(`real keyboard contextual ${state}`, action.fighters[0].action === state, action);
    await page.keyboard.up(modifier);
    await page.waitForTimeout(1050);
  }
  await force({phase:'fight', fighters:[{x:1450,y:590,action:null,stun:0},{x:1720,y:590,action:null,stun:0}]});
  await page.waitForTimeout(450);
  check("larger arena camera follows beyond original boundary", (await snap()).cameraX > 400 && (await snap()).worldWidth === 1920, await snap());
  await capture('scrolling-arena-v2');
  await reset();
  await page.locator("#pauseButton").click();
  const paused = await snap();
  await page.waitForTimeout(300);
  const pausedAfter = await snap();
  check(
    "pause freezes simulation",
    paused.paused && paused.timer === pausedAfter.timer,
    { paused, pausedAfter },
  );
  await capture("pause");
  await page.locator("#resumeButton").click();
  check("resume", !(await snap()).paused);
  await press("Escape");
  check(
    "Escape pauses",
    (await snap()).paused && (await page.locator("#matchOverlay").isVisible()),
  );
  await press("Escape");
  check(
    "Escape resumes and hides overlay",
    !(await snap()).paused &&
      !(await page.locator("#matchOverlay").isVisible()),
  );
  await page.locator("#pauseButton").click();
  await page.locator("#pauseOptionsButton").click();
  await page.locator("#muteButton").click();
  check(
    "mute reaches engine",
    await page.evaluate(
      () =>
        window.__fight.options.muted ===
        (document.querySelector("#muteButton").getAttribute("aria-pressed") ===
          "true"),
    ),
  );
  check(
    "mute preference persisted",
    await page.evaluate(
      () =>
        localStorage.getItem("after-hours-muted") ===
        String(window.__fight.options.muted),
    ),
  );
  await page.locator("#closeControls").click();
  await page.locator("#resumeButton").click();
  await force({ phase: "fight", fighters: [{ health: 100 }, { health: 0 }] });
  await page.waitForTimeout(100);
  check("KO grants round", (await snap()).wins[0] === 1, await snap());
  await page.waitForFunction(() => window.__fight.round === 2, {
    timeout: 6000,
  });
  await force({ phase: "fight", fighters: [{ health: 100 }, { health: 0 }] });
  await page
    .locator("#rematchButton")
    .waitFor({ state: "visible", timeout: 7000 });
  check("match ends after two wins", (await snap()).wins[0] === 2);
  await capture("result");
  await page.locator("#rematchButton").click();
  await readyFight();
  check(
    "rematch resets rounds",
    (await snap()).round === 1 && (await snap()).wins[0] === 0,
  );
  await menu();
  for (const stage of [1, 2]) {
    await setup("training", stage);
    await capture(`stage-${stage}`);
    check(`stage ${stage} chosen`, (await snap()).stage === stage);
    await menu();
  }
  await setup("arcade");
  const cpuBefore = await snap();
  await page.waitForTimeout(6500);
  const cpuAfter = await snap();
  check(
    "CPU approaches and attacks",
    cpuAfter.fighters[0].health < 100 &&
      Math.abs(cpuAfter.fighters[1].x - cpuAfter.fighters[0].x) <
        Math.abs(cpuBefore.fighters[1].x - cpuBefore.fighters[0].x),
    { cpuBefore, cpuAfter },
  );
  await menu();
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("mobile-menu");
  await setup("training");
  await capture("mobile-fight");
  const overflow = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  check(
    "mobile no horizontal overflow",
    overflow.content <= overflow.viewport,
    overflow,
  );
  await force({
    phase: "fight",
    fighters: [
      { x: 500, y: 590, action: null },
      { x: 600, y: 590, health: 100, action: null },
    ],
  });
  await page.locator(".touch-attacks button").first().click();
  await page.waitForTimeout(500);
  check(
    "mobile touch punch",
    (await snap()).fighters[1].health < 100,
    await snap(),
  );
  await force({
    phase: "fight",
    energy: 100,
    fighters: [
      { x: 400, y: 590, action: null, stun: 0 },
      { x: 750, y: 590, health: 100, action: null, stun: 0 },
    ],
  });
  await page
    .locator(".touch-attacks button")
    .filter({ hasText: /^SP$/ })
    .click();
  await page.waitForTimeout(900);
  check(
    "mobile touch special damages and consumes energy",
    (await snap()).fighters[1].health < 100 &&
      (await snap()).fighters[0].energy < 100,
    await snap(),
  );
} catch (error) {
  report.errors.push(error.stack);
} finally {
  check("no page errors", report.errors.length === 0, report.errors);
  await fs.writeFile(
    "artifacts/playtest.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        checks: report.checks.map(({ name, pass }) => ({ name, pass })),
        errors: report.errors,
      },
      null,
      2,
    ),
  );
  await browser.close();
  if (report.errors.length || report.checks.some((check) => !check.pass))
    process.exitCode = 1;
}
