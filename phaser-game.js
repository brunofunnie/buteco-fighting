import { FightGame as CombatSimulation } from './game.js';
import { scoreTick } from './music.js';

// Phaser owns one visible canvas and one scene clock. The fighting simulation
// draws to its own framebuffer, keeping combat timing independent of rendering.
let runtime;
let activeFight;

function boot(canvas) {
  if (runtime) return runtime;
  const Phaser = window.Phaser;
  if (!Phaser) throw new Error('Não foi possível carregar o motor do jogo.');
  class ArenaScene extends Phaser.Scene {
    constructor() { super('Arena'); }
    create() {
      this.framebuffer = this.textures.createCanvas('combat-frame', 1280, 720);
      this.add.image(0, 0, 'combat-frame').setOrigin(0);
      this.game.events.on('poststep', () => {
        const fight = activeFight;
        if (!fight?.running) return;
        // Paint directly into the displayed texture: no intermediate copy.
        fight.canvas = this.framebuffer.canvas;
        fight.ctx = this.framebuffer.context;
        fight.draw();
        this.framebuffer.refresh();
      });
    }
    update(time, delta) {
      const fight = activeFight;
      if (!fight?.running) return;
      if (!fight.paused && !fight.inspectionPaused) {
        this.accumulator = Math.min((this.accumulator || 0) + delta / 1000, 0.05);
        while (this.accumulator >= 1 / 120) {
          fight.update(1 / 120);
          fight.pressed.clear();
          this.accumulator -= 1 / 120;
        }
      } else this.accumulator = 0;
      scoreTick(fight);
    }
  }
  runtime = new Phaser.Game({
    type: Phaser.CANVAS, canvas, width: 1280, height: 720,
    backgroundColor: '#070b17', banner: false,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false },
    render: { antialias: true, roundPixels: false },
    fps: { target: 120, forceSetTimeOut: false, smoothStep: false },
    scene: ArenaScene,
  });
  window.__phaser = runtime;
  return runtime;
}

export class FightGame extends CombatSimulation {
  constructor(canvas, assets, options) {
    super(document.createElement('canvas'), assets, options);
    this.visibleCanvas = canvas;
    this.phaser = boot(canvas);
    activeFight = this;
  }
  start(config) {
    super.start(config);
    cancelAnimationFrame(this.frame);
    activeFight = this;
    this.initAudio();
  }
  destroy() {
    super.destroy();
    if (activeFight === this) activeFight = null;
  }
  // Verification can freeze simulation without disabling the renderer.
  freezeForInspection(value = true) { this.inspectionPaused = value; }
}
