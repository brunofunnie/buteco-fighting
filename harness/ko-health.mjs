import assert from 'node:assert/strict';
import { FightGame } from '../src/game.js';

globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

for (const superMove of [false, true]) {
  for (const targetIndex of [0, 1]) {
    const game = new FightGame({ getContext: () => ({}) });
    game.start({ mode: 'versus', muted: true });
    game.phase = 'fight';
    const target = game.fighters[targetIndex];
    const attacker = game.fighters[1 - targetIndex];
    target.health = 5;
    target.displayHealth = 70;
    game.releasePower(attacker, target, superMove);
    for (const projectile of game.projectiles) {
      projectile.x = target.x;
      projectile.y = target.y - 180;
      projectile.vx = 0;
      projectile.vy = 0;
    }
    game.update(1 / 120);
    assert.equal(target.health, 0, 'projectile must deliver lethal damage');
    assert.equal(game.phase, 'roundEnd', 'lethal projectile must finish the round');
    assert.equal(target.displayHealth, 0, 'KO must empty the animated health bar');
    for (let frame = 0; frame < 120; frame++) game.update(1 / 120);
    assert.equal(target.displayHealth, 0, 'health bar must remain empty during results');
    game.destroy();
  }
}
console.log('Lethal special and super empty both health bars during results.');
