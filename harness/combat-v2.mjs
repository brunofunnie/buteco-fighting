import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { FightGame } from "../src/game.js";

globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const results = [];
function scenario() {
  const game = new FightGame({ getContext: () => ({}) });
  game.start({ mode: "training" });
  game.debugForce({ phase: "fight", cpu: false });
  const [attacker, target] = game.fighters;
  Object.assign(attacker, { x: 600, energy: 100 });
  Object.assign(target, { x: 700 });
  return { game, attacker, target };
}
function press(game, ...codes) {
  for (const code of codes) {
    game.keys.add(code);
    game.pressed.add(code);
  }
  game.update(0.016);
  game.pressed.clear();
}
function advance(game, duration) {
  for (let time = 0; time < duration; time += 0.016) {
    game.update(0.016);
    game.pressed.clear();
  }
}
function check(name, test) {
  try {
    test(scenario());
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, error: error.message });
  }
}

for (const [codes, expected] of [
  [["KeyJ"], "punch"],
  [["KeyK"], "kick"],
  [["KeyS", "KeyJ"], "crouchPunch"],
  [["KeyS", "KeyK"], "crouchKick"],
  [["KeyS", "KeyU"], "uppercut"],
  [["KeyS", "KeyI"], "sweep"],
  [["KeyW", "KeyJ"], "airPunch"],
  [["KeyW", "KeyK"], "airKick"],
]) {
  check(`${codes.join(" + ")} selects ${expected}`, ({ game, attacker }) => {
    press(game, ...codes);
    assert.equal(attacker.action, expected);
    if (expected.startsWith("air")) assert.ok(attacker.y < 590);
  });
}

check("crouch kick inflicts damage when the visible foot touches a leg", ({ game, target }) => {
  target.x=740;
  press(game, "KeyS", "KeyK");
  advance(game, 0.3);
  assert.ok(target.health < 100);
});
check("small projectile through the visible gap between legs misses", ({game,attacker,target}) => {
  const p={owner:attacker,x:target.x,y:target.y-15,vx:0,vy:0,radius:3,life:1,damage:10,hitTargets:new Set()};
  game.projectiles=[p];game.updateProjectiles(.016);assert.equal(target.health,100);
  const leg=game.combatBoxes(target).hurt.find(b=>b[1]<=p.y&&b[1]+b[3]>p.y);
  assert.ok(leg);p.x=leg[0]+leg[2]/2;game.updateProjectiles(.016);assert.ok(target.health<100);
});
check("attack startup does not inflict instant damage", ({ game, target }) => {
  press(game, "KeyK");
  advance(game, 0.08);
  assert.equal(target.health, 100);
});
check("one swing cannot inflict repeated damage", ({ game, target }) => {
  press(game, "KeyJ");
  advance(game, 0.2);
  const health = target.health;
  assert.ok(health < 100);
  advance(game, 0.2);
  assert.equal(target.health, health);
});
check("recovering attack cannot be replaced by another button", ({ game, attacker }) => {
  press(game, "KeyK");
  advance(game, 0.06);
  press(game, "KeyJ");
  assert.equal(attacker.action, "kick");
});

for (const [level, crouch, blocked] of [
  ["low", false, false],
  ["low", true, true],
  ["overhead", true, false],
  ["overhead", false, true],
  ["mid", false, true],
  ["mid", true, true],
]) {
  check(`${level} versus ${crouch ? "low" : "standing"} guard ${blocked ? "blocks" : "connects"}`, ({ game, attacker, target }) => {
    Object.assign(target, { guard: true, crouch });
    game.hitFighter(attacker, target, 10, 20, 100, { level });
    assert.equal(target.health, blocked ? 99.2 : 90);
    assert.equal(attacker.combo, blocked ? 0 : 1);
  });
}

check("uppercut catches an airborne opponent and launches", ({ game, attacker, target }) => {
  Object.assign(target, { y: 470, vy: 0 });
  press(game, "KeyS", "KeyU");
  advance(game, 0.17);
  assert.ok(target.health < 100);
  assert.ok(target.vy < 0);
  assert.ok(attacker.combo > 0);
});
check("uppercut misses an opponent vertically above its reach", ({ game, target }) => {
  Object.assign(target, { y: 160, vy: -100 });
  press(game, "KeyS", "KeyU");
  advance(game, 0.17);
  assert.equal(target.health, 100);
});
check("grounded low kick misses a high jumping opponent", ({ game, target }) => {
  Object.assign(target, { y: 300, vy: -200 });
  press(game, "KeyS", "KeyK");
  advance(game, 0.22);
  assert.equal(target.health, 100);
});
check("sweep knockdown enters recovery then returns to play", ({ game, target }) => {
  press(game, "KeyS", "KeyI");
  advance(game, 0.3);
  assert.ok(target.health < 100);
  assert.ok(target.knockdown > 0);
  assert.equal(target.state, "ko");
  advance(game, 1.2);
  assert.equal(target.knockdown, 0);
  assert.equal(target.stun <= 0, true);
  assert.equal(target.state, "idle");
});
check("two timely successful attacks accumulate combo count", ({ game, attacker, target }) => {
  press(game, "KeyJ");
  advance(game, 0.45);
  target.x = attacker.x + 100;
  game.keys.delete("KeyJ");
  press(game, "KeyJ");
  advance(game, 0.2);
  assert.equal(attacker.combo, 2);
});
check("combo count expires after inactivity", ({ game, attacker }) => {
  Object.assign(attacker, { combo: 3, comboTime: 0.1 });
  advance(game, 0.3);
  assert.equal(attacker.combo, 0);
});
check("double direction tap keeps normal walking speed", ({ game, attacker, target }) => {
  target.x = 1050;
  press(game, "KeyD");
  game.keys.delete("KeyD");
  advance(game, 0.08);
  press(game, "KeyD");
  assert.equal(attacker.state, "walk");
  const x = attacker.x;
  advance(game, 0.08);
  assert.ok(attacker.x - x < 40);
});
check("walking away selects retreat animation", ({ game, attacker }) => {
  press(game, "KeyA");
  assert.equal(attacker.state, "backwalk");
});
check("guard plus crouch selects low block", ({ game, attacker }) => {
  press(game, "KeyS", "KeyL");
  assert.equal(attacker.state, "lowBlock");
  assert.equal(attacker.guard, true);
});
check("world scrolling keeps fighters within camera framing", ({ game, attacker, target }) => {
  Object.assign(attacker, { x: 1400 });
  Object.assign(target, { x: 1770 });
  advance(game, 1);
  assert.ok(game.cameraX > 500);
  assert.ok(attacker.x - game.cameraX > 0);
  assert.ok(target.x - game.cameraX < 1280);
  assert.equal(game.snapshot().worldWidth, 1920);
});
check("opponents cannot separate farther than viewport width", ({ game, attacker, target }) => {
  Object.assign(attacker, { x: 75 });
  Object.assign(target, { x: 1845 });
  game.resolveBodies();
  assert.ok(Math.abs(target.x - attacker.x) <= 1100);
});
check("fighters can advance beyond the original stage boundary", ({ game, attacker, target }) => {
  Object.assign(attacker, { x: 1310 });
  Object.assign(target, { x: 1750 });
  press(game, "KeyD");
  advance(game, 0.2);
  assert.ok(attacker.x > 1350);
});

await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/combat-v2.json", JSON.stringify({ results }, null, 2));
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"} ${result.name}${result.error ? `: ${result.error}` : ""}`);
}
const failures = results.filter((result) => !result.passed);
console.log(`${results.length - failures.length}/${results.length} combat simulation checks passed`);
if (failures.length) process.exitCode = 1;
