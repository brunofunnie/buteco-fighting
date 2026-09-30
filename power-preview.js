import {FightGame} from './game.js';
import {FIGHTERS, defaultOpponent} from './roster.js';

const LOOP_SECONDS = 3.8;
const IDLE_SECONDS = .45;

// Uses the same input, physics, damage and effect renderer as a playable fight.
// The owning menu supplies animation frames so previews never own a global loop.
export class PowerPreview {
  constructor(canvas, assets, {player, opponent, facing = 1, onMove} = {}) {
    this.canvas = canvas;
    this.facing = facing < 0 ? -1 : 1;
    this.onMove = onMove;
    this.game = new FightGame(canvas, assets, {muted:true, interactive:false});
    Object.assign(this.game, {
      player: FIGHTERS[player] ? player : 'maya',
      opponent: FIGHTERS[opponent] ? opponent : defaultOpponent(player),
      mode: 'training', stage: 0, elapsed: 0, round: 1, wins: [0,0],
      cpuEnabled: false,
    });
    this.game.drawStage = context => this.drawGrid(context);
    this.game.drawHUD = () => {};
    this.game.drawPowerReflections = () => {};
    this.reset('special');
  }
  get move() { return this.currentMove; }
  reset(move) {
    this.currentMove = move;
    this.time = 0;
    this.triggered = false;
    this.game.resetRound();
    this.game.phase = 'fight';
    this.game.fighters[0].x = 960 - 220 * this.facing;
    this.game.fighters[1].x = 960 + 220 * this.facing;
    this.game.fighters[0].facing = this.facing;
    this.game.fighters[1].facing = -this.facing;
    this.game.fighters[0].energy = 100;
    Object.assign(this.canvas.dataset, {
      demoMove: move, demoFighter: this.game.player, demoReady: 'true',
    });
    const power = FIGHTERS[this.game.player].power;
    this.onMove?.({move, label:move === 'super' ? power.superLabel : power.label, key:move === 'super' ? 'I' : 'U'});
  }
  tick(dt) {
    if (this.destroyed || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = dt;
    while (remaining > 1e-8) {
      // Fixed upper bound keeps fast projectiles from tunneling after a slow frame.
      const step = Math.min(remaining, 1/120, LOOP_SECONDS - this.time);
      if (!this.triggered && this.time + step >= IDLE_SECONDS - 1e-8) {
        this.game.pressed.add(this.move === 'super' ? 'KeyI' : 'KeyU');
        this.triggered = true;
      }
      this.game.update(step);
      this.game.pressed.clear();
      this.time += step;
      remaining -= step;
      if (this.time >= LOOP_SECONDS - 1e-8) this.reset(this.move === 'special' ? 'super' : 'special');
    }
  }
  draw() { if (!this.destroyed) this.game.draw(); }
  drawGrid(c) {
    c.fillStyle = '#10151e';
    c.fillRect(0,0,1280,720);
    c.lineWidth = 1;
    c.strokeStyle = '#91a6bd22';
    c.beginPath();
    for (let x=0;x<=1280;x+=80) { c.moveTo(x,0); c.lineTo(x,720); }
    for (let y=30;y<=720;y+=80) { c.moveTo(0,y); c.lineTo(1280,y); }
    c.stroke();
    c.strokeStyle = '#91a6bd80';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(32,590);c.lineTo(1248,590);
    c.moveTo(640,686);c.lineTo(640,28);
    c.moveTo(1236,582);c.lineTo(1248,590);c.lineTo(1236,598);
    c.moveTo(632,40);c.lineTo(640,28);c.lineTo(648,40);
    c.stroke();
    c.fillStyle = '#bdccda';
    c.font = '20px monospace';
    c.fillText('X',1236,622);
    c.fillText('Y',660,44);
    c.font = '16px monospace';
    c.fillText('0',650,613);
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.game.destroy();
    this.canvas.dataset.demoReady = 'false';
  }
}
