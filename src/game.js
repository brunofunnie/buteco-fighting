import {alternateSprite} from './alternate-palette.js';
import {startDevonSlide,tickDevonSlide} from './devon-slide.js';
import {DEFAULT_CONTROLS, controlSettings, gamepads} from "./controls.js";
import {audioDirector} from "./audio.js";
import {INTRO_SECONDS,fightIntro} from './fight-intro.js';
import { FIGHTERS, NON_PLAYABLE_FIGHTERS } from "./roster.js";
import { drawArena, arenaPalette } from "./stages.js";
import {animationIndex,FRAME_ALIASES,collisionFrame,worldBoxes,overlap,projectileConnects} from "./collision.js";
const W = 1280,
  H = 720,
  FLOOR = 590,
  WORLD = 1920,
  GRAVITY = 2000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const MOVES = {
  punch: {
    duration: 0.34,
    active: 0.11,
    end: 0.2,
    reach: 122,
    damage: 8,
    push: 34,
    energy: 8,
  },
  kick: {
    duration: 0.55,
    active: 0.18,
    end: 0.31,
    reach: 174,
    damage: 13,
    push: 54,
    energy: 12,
  },
  airPunch: { duration: 0.38, active: 0.1, end: 0.25, reach: 134, damage: 9, push: 38, energy: 9, level: "overhead", height: 165 },
  airKick: { duration: 0.5, active: 0.14, end: 0.32, reach: 186, damage: 14, push: 55, energy: 12, level: "overhead", height: 110 },
  crouchPunch: { duration: 0.32, active: 0.09, end: 0.19, reach: 116, damage: 6, push: 25, energy: 7, level: "mid", height: 130 },
  crouchKick: { duration: 0.49, active: 0.14, end: 0.29, reach: 178, damage: 11, push: 45, energy: 10, level: "low", height: 55 },
  uppercut: { duration: 0.76, active: 0.12, end: 0.35, reach: 115, damage: 18, push: 150, energy: 15, level: "mid", height: 220, launch: true },
  sweep: { duration: 0.7, active: 0.2, end: 0.36, reach: 200, damage: 16, push: 75, energy: 12, level: "low", height: 40, knockdown: true },
  special: { duration: 0.65, active: 0.23, end: 0.3, cost: 25 },
  super: { duration: 0.95, active: 0.3, end: 0.4, cost: 100 },
};
const PROFILES = {...FIGHTERS,...NON_PLAYABLE_FIGHTERS};
const moveFor = (fighter, action) => {
  const move = MOVES[action],
    profile = PROFILES[fighter.id];
  return {
    ...move,
    duration: move.end * profile.tempo + (move.duration - move.end) * profile.tempo * 0.86,
    active: move.active * profile.tempo,
    end: move.end * profile.tempo,
    damage: profile.damage[action] ?? move.damage,
  };
};


export class FightGame {
  constructor(canvas, assets = {}, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.assets = assets;
    this.options = options;
    this.spriteBounds = new WeakMap();
    this.hologramSprites = new WeakMap();
    this.cameraX = (WORLD - W) / 2;
    canvas.width = W;
    canvas.height = H;
    this.keys = new Set();
    this.pressed = new Set();
    this.running = false;
    this.paused = false;
    this.onKeyDown = (e) => {
      if (
        this.controls.some((c) => Object.values(c).flat().includes(e.code)) ||
        e.code === "Escape"
      )
        e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.options.online) this.sendOnlineInput();
      if (e.code === "Escape" && !e.repeat) {
        if (this.paused) this.resume();
        else {
          this.pause();
          this.options.onPause?.();
        }
      }
      this.initAudio();
    };
    this.onKeyUp = (e) => { this.keys.delete(e.code); if (this.options.online) this.sendOnlineInput(); };
    this.onBlur = () => {
      this.keys.clear();
      this.pressed.clear();
      if (this.running && !this.paused) {
        this.pause();
        this.options.onPause?.();
      }
    };
    if (options.interactive !== false) {
      window.addEventListener("keydown", this.onKeyDown);
      window.addEventListener("keyup", this.onKeyUp);
      window.addEventListener("blur", this.onBlur);
      window.__fight = this;
    }
    this.loop = this.loop.bind(this);
  }
  start({
    player = "maya",
    opponent,
    mode = "arcade",
    stage = 0,
    difficulty = "normal",
  } = {}) {
    if (!this.options.headless) cancelAnimationFrame(this.frame);
    this.player = FIGHTERS[player] ? player : "maya";
    this.opponent = PROFILES[opponent] ? opponent : Object.keys(FIGHTERS).find(id => id !== this.player);
    this.mode = mode;
    this.stage = clamp(Number(stage) || 0,0,4);
    this.difficulty = difficulty;
    this.cpuEnabled = mode !== "training";
    this.wins = [0, 0];
    this.round = 1;
    this.elapsed = 0;
    this.running = true;
    this.paused = false;
    this.resetRound();
    this.last = performance.now();
    if (!this.options.headless) this.frame = requestAnimationFrame(this.loop);
  }
  resetRound() {
    this.fighters = [
      this.makeFighter(this.player, WORLD / 2 - 290, 1),
      this.makeFighter(this.opponent, WORLD / 2 + 290, -1),
    ];
    this.cameraX = (WORLD - W) / 2;
    this.projectiles = [];
    this.powerEffects = [];
    this.particles = [];
    this.timer = 99;
    this.phase = "intro";
    this.phaseTime = INTRO_SECONDS;
    this.introVoiceRound=null;
    this.hitstop = 0;
    this.shake = 0;
    this.keys.clear();
    this.pressed.clear();
  }
  makeFighter(id, x, facing) {
    return {
      id,
      name: PROFILES[id].name.toUpperCase(),
      pixelMotion: !!this.assets[id]?.idle?.animation?.joeSequence,
      color: PROFILES[id].color,
      armorTime: 0,
      powerState: null,
      x,
      y: FLOOR,
      vy: 0,
      facing,
      health: 100,
      displayHealth: 100,
      energy: 0,
      state: "idle",
      stateTime: 0,
      action: null,
      actionTime: 0,
      hit: false,
      stun: 0,
      guard: false,
      crouch: false,
      combo: 0,
      comboTime: 0,
      aiWait: 0,
      slide:null,slideCooldown:0,slideTrail:[],
      jumpMove: 0,
      knockdown: 0,
      vx: 0, airVX: 0, landTime: 0, turnTime: 0, turnFrom: facing, turnTo: facing,
      bufferedAction: null,
    };
  }
  snapshot() {
    return {
      mode: this.mode,
      stage: this.stage,
      phase: this.phase,
      round: this.round,
      timer: this.timer,
      wins: [...(this.wins || [])],
      paused: this.paused,
      projectiles: this.projectiles?.length || 0,
      worldWidth: WORLD,
      cameraX: this.cameraX,
      fighters: (this.fighters || []).map(
        ({ id, x, y, facing, health, energy, state, action, guard }) => ({
          id,
          x,
          y,
          facing,
          health,
          energy,
          state,
          action,
          guard,
        }),
      ),
    };
  }
  debugForce({ phase, timer, fighters, energy, cpu } = {}) {
    if (phase) this.phase = phase;
    if (cpu !== undefined) this.cpuEnabled = cpu;
    if (timer !== undefined) this.timer = timer;
    if (energy !== undefined)
      for (const f of this.fighters || []) f.energy = energy;
    if (fighters)
      fighters.forEach((values, index) => {
        if (this.fighters[index]) Object.assign(this.fighters[index], values);
      });
    return this.snapshot();
  }
  pause() {
    this.options.onInput?.([]);
    this.paused = true;
    this.keys.clear();
    this.pressed.clear();
  }
  resume() {
    this.paused = false;
    this.last = performance.now();
  }
  destroy() {
    this.running = false;
    if (!this.options.headless) cancelAnimationFrame(this.frame);
    if (this.options.interactive !== false) {
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      window.removeEventListener("blur", this.onBlur);
    }
    this.audio?.close().catch(() => {});
    if (typeof window !== "undefined" && window.__fight === this) delete window.__fight;
  }
  initAudio() {
    audioDirector.unlock().catch(()=>{});
    if (!this.audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (Audio) this.audio = new Audio();
    }
    this.audio?.resume().catch(() => {});
  }
  sound(kind, fighter) {
    if (this.options.muted) return;
    if(audioDirector.combat(kind,fighter,this.cameraX))return;
    if(!this.audio)return;
    const o = this.audio.createOscillator(),
      g = this.audio.createGain(),
      now = this.audio.currentTime;
    o.type = kind === "hit" ? "sawtooth" : "sine";
    o.frequency.setValueAtTime(
      kind === "hit" ? 150 : kind === "super" ? 680 : 320,
      now,
    );
    o.frequency.exponentialRampToValueAtTime(40, now + 0.18);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    o.connect(g);
    g.connect(audioDirector.outputFor(this.audio,"effects"));
    o.start(now);
    o.stop(now + 0.21);
  }
  loop(now) {
    const dt = Math.min((now - this.last) / 1000, 0.035);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.draw();
    this.pressed.clear();
    if (this.running) this.frame = requestAnimationFrame(this.loop);
  }
  get controls() { return this.options.interactive === false ? DEFAULT_CONTROLS : controlSettings.keyboard; }
  inputHeld(index, action) { return [this.controls[index][action]].flat().some(k => this.keys.has(k)) || !!this.padFrames?.[index]?.held.has(action); }
  inputPressed(index, action) { return [this.controls[index][action]].flat().some(k => this.pressed.has(k)) || !!this.padFrames?.[index]?.pressed.has(action); }
  sendOnlineInput() {
    if (this.paused) { this.options.onInput?.([]); return; }
    this.options.onInput?.(Object.keys(DEFAULT_CONTROLS[0]).filter(action => this.inputHeld(0, action)));
  }
  update(dt) {
    if (this.options.online) {
      this.padFrames = gamepads.poll();
      this.sendOnlineInput();
      if (this.padFrames.some(p => p.pressed.has("pause"))) { this.pause(); this.options.onPause?.(); }
      return;
    }
    if (this.options.interactive !== false) {
      this.padFrames = gamepads.poll();
      if (this.padFrames.some(p => p.pressed.has("pause"))) { this.pause(); this.options.onPause?.(); return; }
    }
    this.elapsed += dt;
    this.shake = Math.max(0, this.shake - dt * 45);
    this.powerEffects = this.powerEffects.filter(e => (e.life -= dt) > 0);
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 450 * dt;
      p.life -= dt;
      if(p.kind?.startsWith("blood") && p.y>=FLOOR){p.y=FLOOR;p.vx*=.75;p.vy=0;p.life=Math.min(p.life,.12);}
    }
    if (this.hitstop > 0) {
      // Impact briefly freezes bodies, but must not discard a fresh attack.
      this.fighters.forEach((f, index) => {
        if (index > 0 && this.mode !== "versus") return;
        const action = ["super", "special", "kick", "punch"].find(name =>
          this.inputPressed(index, name));
        if (action) f.bufferedAction = {
          action, crouch: this.inputHeld(index, "crouch"), expires: this.elapsed + 0.13,
        };
      });
      this.hitstop -= dt;
      return;
    }
    if (this.phase !== "fight") {
      if(this.phase==="roundEnd")this.updateProjectiles(dt,false);
      for (const f of this.fighters) {
        f.stateTime += dt;
        if (this.phase === "roundEnd" && f.y < FLOOR) {
          if (!wasGrounded) f.jumpElapsed = (f.jumpElapsed || 0) + dt;
    f.vy += GRAVITY * dt;
          f.y = Math.min(FLOOR, f.y + f.vy * dt);
          if (f.y === FLOOR) {
            f.vy = 0;
            this.burst(f.x, FLOOR, "#d1ac7744", 8);
          }
        }
      }
      this.phaseTime -= dt;
      if (this.phaseTime <= 0) {
        if (this.phase === "intro") this.phase = "fight";
        else if (this.wins.some((n) => n >= 2)) {
          this.running = false;
          this.options.onEnd?.(this.fighters[this.wins[0] >= 2 ? 0 : 1].id);
        } else {
          this.round++;
          this.resetRound();
        }
      }
      return;
    }
    if (this.mode !== "training") this.timer = Math.max(0, this.timer - dt);
    this.fighters.forEach((f, i) =>
      this.updateFighter(f, this.fighters[1 - i], i, dt),
    );
    this.resolveBodies();
    const center = (this.fighters[0].x + this.fighters[1].x) / 2;
    this.cameraX += (clamp(center - W / 2, 0, WORLD - W) - this.cameraX) * (1 - Math.exp(-dt * 10));
    this.updateProjectiles(dt);
    if (this.mode === "training") {
      for (const f of this.fighters) if (f.health < 25) f.health = 100;
    } else if (this.fighters.some((f) => f.health <= 0) || this.timer <= 0)
      this.finishRound();
  }
  getInput(f, enemy, index, dt) {
    if (index === 0 || this.mode === "versus") {
      return {
        move: Number(this.inputHeld(index, "right")) - Number(this.inputHeld(index, "left")),
        jump: this.inputPressed(index, "jump"),
        crouch: this.inputHeld(index, "crouch"),
        guard: this.inputHeld(index, "guard"),
        action: ["super", "special", "kick", "punch"].find((a) =>
          this.inputPressed(index, a),
        ),
      };
    }
    if (this.cpuEnabled === false)
      return { move: 0, guard: false };
    f.aiWait -= dt;
    const distance = Math.abs(f.x - enemy.x),
      multiplier =
        this.difficulty === "hard"
          ? 0.65
          : this.difficulty === "easy"
            ? 1.65
            : 1;
    const input = {
      move:
        distance > 142
          ? Math.sign(enemy.x - f.x)
          : distance < 82
            ? -Math.sign(enemy.x - f.x)
            : 0,
      guard: enemy.action && distance < 205 && f.aiWait > 0.15,
      crouch: enemy.action && ["crouchKick", "sweep"].includes(enemy.action) && Math.random() > 0.25,
    };
    if (f.aiWait <= 0) {
      f.aiWait = (0.3 + Math.random() * 0.6) * multiplier;
      if(f.id==='devon'&&f.energy>=25&&f.slideCooldown<=0&&distance>110&&distance<420&&f.y===FLOOR){input.slide=true;input.jump=false;input.crouch=false;return input;}
      if (f.energy >= 100 && distance < 500) input.action = "super";
      else if (f.energy >= 25 && distance > 230 && Math.random() > 0.35)
        input.action = "special";
      else if (distance < 182)
        input.action = Math.random() > 0.45 ? "kick" : "punch";
      input.jump = f.id !== 'devon' && distance > 180 && Math.random() > 0.82;
      if (distance < 180 && Math.random() > 0.7) input.crouch = true;
    }
    return input;
  }
  updateFighter(f, enemy, index, dt) {
    const wasGrounded = f.y === FLOOR;
    f.stateTime += dt;
    f.displayHealth += (f.health - f.displayHealth) * (1 - Math.exp(-dt * 5));
    f.armorTime = Math.max(0, f.armorTime - dt);
    f.slideCooldown=Math.max(0,(f.slideCooldown||0)-dt);
    f.slideTrail=(f.slideTrail||[]).filter(copy=>(copy.life-=dt)>0);
    this.updatePowerState(f, enemy, dt);
    f.comboTime -= dt;
    if (f.comboTime <= 0) f.combo = 0;
    if (!wasGrounded) f.jumpElapsed = (f.jumpElapsed || 0) + dt;
    f.vy += GRAVITY * dt;
    f.y = Math.min(FLOOR, f.y + f.vy * dt);
    const grounded = f.y === FLOOR;
    if (grounded) f.vy = 0;
    const landed = grounded && !wasGrounded;
    if (landed && f.health > 0) {
      f.landTime = 0.11;
      this.setState(f, "land");
      this.burst(f.x, FLOOR, "#a6b5c344", 5);
    } else f.landTime = Math.max(0, f.landTime - dt);
    if(f.slide){
      const slide=tickDevonSlide(f,enemy,dt,{minX:70,maxX:WORLD-70,floor:FLOOR});
      if(slide.active){
        f.guard=false;f.crouch=false;f.bufferedAction=null;f.vx=0;f.turnTime=0;
        this.setState(f,'slide');
        // Space echoes by distance so slower slides do not stack silhouettes.
        const lastCopy=f.slideTrail.at(-1);
        if(f.slide?.phase==='travel' && (!lastCopy || Math.abs(f.x-lastCopy.x)>=85)){
          f.slideTrail.push({x:f.x,y:f.y,facing:f.facing,stateTime:f.stateTime,life:.38});
        }
        return;
      }
      if(slide.finished){this.setState(f,'idle');return;}
    }
    if (f.stun > 0 || f.knockdown > 0) {
      f.stun -= dt;
      f.bufferedAction = null;
      this.setState(f, f.health <= 0 ? "ko" : f.knockdown > 0 ? "ko" : f.guard ? (f.crouch ? "lowBlock" : "block") : "hurt");
      if(f.knockdown > 0){
        f.x=clamp(f.x+(f.airVX||0)*dt,60,WORLD-60);
        f.airVX *= Math.exp(-dt*(grounded?10:1.5));
        if(grounded){
          f.knockdown=Math.max(0,f.knockdown-dt);
          if(f.knockdown===0){f.airVX=0;f.landTime=.11;}
        }else f.stun=Math.max(f.stun,dt);
      }
      return;
    }
    const input = this.getInput(f, enemy, index, dt);
    if(input.slide&&startDevonSlide(f,enemy,{minX:70,maxX:WORLD-70,floor:FLOOR})){
      f.guard=false;f.crouch=false;f.bufferedAction=null;f.vx=0;f.turnTime=0;
      this.setState(f,'slide');this.sound('special',f);return;
    }
    if (input.action) f.bufferedAction = {action:input.action, crouch:!!input.crouch, expires:this.elapsed + 0.13};
    if (f.bufferedAction?.expires < this.elapsed) f.bufferedAction = null;
    if (!grounded) {
      if (input.move) f.airVX += (input.move * PROFILES[f.id].speed * 1.15 - f.airVX) * (1 - Math.exp(-dt * 5));
      f.x = clamp(f.x + f.airVX * dt, 70, WORLD - 70);
    }
    f.guard = !!input.guard && !f.action && grounded;
    f.crouch = !!input.crouch && !f.action && grounded;
    if (f.action) {
      const move = moveFor(f, f.action);
      f.actionTime += dt;
      if (!f.hit && f.actionTime >= move.active) {
        if (f.action === "special" || f.action === "super") {
          this.releasePower(f, enemy, f.action === "super");
          f.hit = true;
          this.sound(f.action,f);
        } else if (f.actionTime <= move.end && this.attackConnects(f, enemy, move)) {
          this.hitFighter(f, enemy, move.damage, move.push, move.height ?? (f.action === "punch" ? 205 : 175), move);
          f.energy = clamp(f.energy + move.energy, 0, 100);
          f.hit = true;
        }
      }
      if (f.actionTime >= move.duration || (grounded && ["airPunch", "airKick"].includes(f.action))) {
        f.action = null;
        this.setState(f, grounded ? landed ? "land" : "idle" : f.jumpMove ? "jumpForward" : "jump");
      }
      return;
    }
    const desiredFacing = enemy.x >= f.x ? 1 : -1;
    const queued = f.bufferedAction;
    if (grounded && queued && !f.guard && (f.landTime > 0 || f.turnTime > 0) &&
      (queued.crouch || !MOVES[queued.action]?.cost || f.energy >= MOVES[queued.action].cost)) {
      // A deliberate strike may interrupt neutral landing/turn recovery.
      f.facing = desiredFacing;
      f.turnTime = 0;
      f.landTime = 0;
    }
    if (f.turnTime > 0) {
      f.turnTime = Math.max(0, f.turnTime - dt);
      if (f.turnTime === 0) {
        f.facing = f.turnTo;
        this.setState(f, "idle");
      } else {
        this.setState(f, "turn");
        return;
      }
    }
    if (grounded && f.landTime <= 0 && desiredFacing !== f.facing) {
      f.turnFrom = f.facing;
      f.turnTo = desiredFacing;
      f.turnTime = 0.14;
      this.setState(f, "turn");
      return;
    }
    if (grounded && f.landTime > 0) {
      this.setState(f, "land");
      return;
    }
    if (input.jump && grounded && !f.guard) {
      f.vy = -850;
      f.y -= 1;
      f.crouch = false;
      f.jumpMove = input.move || 0;
      f.jumpElapsed = 0;
      f.jumpBackward = f.jumpMove * f.facing < 0;
      f.airVX = f.jumpMove * PROFILES[f.id].speed * 1.15;
      f.vx = 0;
      this.sound("jump",f);
    }
    let action = f.bufferedAction?.action;
    if (action && !f.guard) {
      if (f.y < FLOOR && ["punch", "kick"].includes(action)) action = action === "punch" ? "airPunch" : "airKick";
      else if (f.bufferedAction.crouch && grounded) action = ({punch:"crouchPunch", kick:"crouchKick", special:"uppercut", super:"sweep"})[action] || action;
      if (MOVES[action] && (!MOVES[action].cost || f.energy >= MOVES[action].cost)) {
        f.action = action;
        f.actionTime = 0;
        f.hit = false;
        f.energy -= MOVES[action].cost || 0;
        f.bufferedAction = null;
        this.setState(f, action);
        if(action!=="special"&&action!=="super")this.sound(action,f);
        return;
      }
    }
    const speed = PROFILES[f.id].speed * 1.08;
    const direction = input.move || 0;
    if (grounded && !f.guard && !f.crouch) {
      f.vx += (direction * speed - f.vx) * (1 - Math.exp(-dt * (direction ? 35 : 45)));
      f.x = clamp(f.x + f.vx * dt, 70, WORLD - 70);
    } else if (grounded) f.vx = 0;
    this.setState(f, f.y < FLOOR ? f.jumpMove ? "jumpForward" : "jump" : f.crouch ? (f.guard ? "lowBlock" : "crouch") : f.guard ? "block" : direction ? (direction === f.facing ? "walk" : "backwalk") : "idle");
  }
  combatBoxes(f) {
    const move=f.action?moveFor(f,f.action):null,frame=collisionFrame(f,move);
    const active=move&&f.actionTime>=move.active&&f.actionTime<=move.end&&!f.hit;
    return {frame:frame.index,hurt:worldBoxes(f,frame.hurt),hit:active?worldBoxes(f,frame.hit):[]};
  }
  attackConnects(attacker,target) {
    const hits=this.combatBoxes(attacker).hit,hurt=this.combatBoxes(target).hurt;
    return hits.some(hit=>hurt.some(body=>overlap(hit,body)));
  }
  setState(f, state) {
    if (f.state !== state) {
      f.state = state;
      f.stateTime = 0;
    }
  }
  resolveBodies() {
    const [a, b] = this.fighters;
    const separation = Math.abs(a.x - b.x);
    if (separation > W - 180) {
      const direction = a.x < b.x ? 1 : -1;
      const excess = (separation - (W - 180)) / 2;
      a.x += direction * excess;
      b.x -= direction * excess;
    }
    const distance = Math.abs(a.x - b.x);
    if (distance < 88 && Math.abs(a.y - b.y) < 140 && a.slide?.phase!=='travel' && b.slide?.phase!=='travel') {
      const direction = a.x < b.x ? 1 : -1,
        correction = (88 - distance) / 2;
      a.x = clamp(a.x - direction * correction, 60, WORLD - 60);
      b.x = clamp(b.x + direction * correction, 60, WORLD - 60);
    }
  }
  hitFighter(
    attacker,
    target,
    damage,
    push = 45,
    impactHeight = attacker.action === "punch"
      ? 205
      : attacker.action === "kick"
        ? 175
        : 180,
    move = {},
  ) {
    const level = move.level || "mid";
    const blocked = target.guard && target.y === FLOOR &&
      (level === "low" ? target.crouch : level === "overhead" ? !target.crouch : true);
    const armored = target.armorTime > 0 && !blocked;
    if (armored) damage *= 0.45;
    damage *= PROFILES[target.id].damageTakenMultiplier ?? 1;
    const healthBefore=target.health;
    target.health = Math.max(
      0,
      target.health - (blocked ? damage * 0.08 : damage),
    );
    target.x = clamp(
      target.x + attacker.facing * (blocked ? push * 0.3 : move.launch && !armored ? 0 : push),
      60,
      WORLD - 60,
    );
    target.stun = blocked ? 0.16 : move.knockdown ? 0.85 : move.launch ? 0.65 : 0.28;
    if (armored) target.stun = 0;
    if (!blocked && move.stun) target.stun = move.stun;
    if (!blocked && !armored && move.launch) {
      target.vy = -430;
      target.y = Math.min(target.y,FLOOR-1);
      target.airVX = attacker.facing * push * 4;
      target.facing = attacker.facing;
      target.turnTime = 0;
      target.knockdown = target.stun = .45;
      target.guard = target.crouch = false;
    }
    if (!blocked && !armored && move.knockdown) {target.knockdown = target.stun;target.airVX=0;}
    target.energy = clamp(target.energy + (blocked ? 5 : 10), 0, 100);
    if (!blocked) {
      if (!armored) target.action = null;
      attacker.combo++;
      attacker.comboTime = 1.4;
    }
    this.hitstop = blocked ? 0.035 : 0.065;
    this.shake = blocked ? 3 : damage > 20 ? 16 : 7;
    this.sound(blocked?"block":"hit",target);
    if(!blocked && target.health<healthBefore)this.bloodBurst(target.x-attacker.facing*28,target.y-impactHeight,attacker.facing,healthBefore-target.health);
  }
  bloodBurst(x,y,direction,damage) {
    const count=Math.min(18,7+Math.ceil(damage*.4));
    this.particles.push({kind:"bloodSplash",x,y,vx:direction*40,vy:0,life:.12,maxLife:.12,color:"#a31524",size:Math.min(19,10+damage*.2)});
    for(let i=0;i<count;i++){
      const speed=90+Math.random()*240,life=.24+Math.random()*.25;
      this.particles.push({kind:"blood",x:x+(Math.random()-.5)*10,y:y+(Math.random()-.5)*12,vx:direction*speed,vy:-150+Math.random()*220,life,maxLife:life,color:["#9e1420","#be2632","#72101b"][i%3],size:1.4+Math.random()*2.2});
    }
  }
  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        speed = 80 + Math.random() * 480;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        life: 0.2 + Math.random() * 0.35,
        maxLife: 0.55,
        color,
        size: 2 + Math.random() * 7,
      });
    }
  }
  releasePower(f, enemy, superMove) {
    const kind = PROFILES[f.id].power?.kind || "orb";
    const projectile = (extras = {}) => {
      const p = { owner: f, x: f.x + f.facing * 80, y: f.y - 180,
        vx: f.facing * (superMove ? 900 : 650), vy: 0, super: superMove,
        kind, life: 2.2, age: 0, damage: superMove ? 32 : 16,
        push: superMove ? 120 : 65, radius: superMove ? 64 : 35,
        hitTargets: new Set(), ...extras };
      this.projectiles.push(p);
      return p;
    };
    if (f.id === 'joe-munist') {
      // Arena 2 coordinates at body scale 2.8; retain the real game's 18 / 39 total damage.
      const scale = (PROFILES[f.id].visualHeight / 94) / 2.8;
      for (const [forward, vertical] of superMove ? [[210,0],[120,-65],[120,65]] : [[120,0]])
        projectile({x:f.x+f.facing*forward*scale,y:f.y-140*scale+vertical*scale,
          vx:f.facing*780,vy:0,damage:superMove?13:18,radius:30});
      return;
    }
    switch (kind) {
      case "solar":
        for(const lane of superMove ? [-1,0,1] : [0]) projectile({vx:f.facing*600,vy:lane*95,explosive:true,damage:superMove?14:18,radius:superMove?42:38});
        break;
      case "pulse":
        for(const index of superMove ? [0,1] : [0]) projectile({x:f.x+f.facing*(80-index*120),vx:f.facing*1200,damage:superMove?19:17,radius:23,life:1.4});
        break;
      case "bass":
        projectile({y:f.y-90,vx:f.facing*740,radius:superMove?105:60,damage:superMove?31:15,push:superMove?180:100,level:"low"});
        break;
      case "gravity":
        projectile({vx:f.facing*320,radius:superMove?78:46,damage:superMove?34:19,stun:superMove?.85:.55,piercing:superMove,life:3});
        break;
      case "solidarity":
        for(const lane of superMove ? [-1,0,1] : [0]) projectile({vx:f.facing*780,vy:lane*80,damage:superMove?13:18,radius:30});
        break;
      case "feather":
        for(const lane of superMove ? [-1,0,1] : [0]) projectile({y:f.y-180+lane*35,vx:f.facing*770,vy:lane*40,damage:superMove?12:14,radius:28,returning:true,life:2.4});
        break;
      case "prism":
        for (const angle of superMove ? [-2,-1,0,1,2] : [-1,0,1])
          projectile({vx:f.facing*980, vy:angle*120, damage:superMove?10:7, radius:24});
        break;
      case "cubes":
        projectile({vx:f.facing*490, damage:superMove?38:20, piercing:true, radius:superMove?80:48});
        break;
      case "runes":
        for (const index of superMove ? [-2,-1,0,1,2] : [-1,0,1])
          projectile({x:f.x+f.facing*(80-index*16), y:f.y-180+index*30,
            vx:f.facing*(700+Math.abs(index)*40), vy:index*55, damage:superMove?10:7, radius:27});
        break;
      case "illusion": {
        const oldX = f.x;
        f.x = clamp(f.x + f.facing*Math.min(superMove?340:220, Math.max(0,Math.abs(enemy.x-f.x)-100)),70,WORLD-70);
        this.powerEffects.push({kind:"illusion",fighterId:f.id,facing:f.facing,state:f.action,frame:1,x:oldX,y:f.y,color:f.color,life:.6,maxLife:.6});
        f.powerState = {kind,remaining:superMove?5:3,clock:0,damage:superMove?9:6,range:260};
        break;
      }
      case "lunar":
        projectile({vx:f.facing*360, radius:superMove?90:55, damage:superMove?28:13, stun:superMove?.95:.65});
        break;
      case "boomerang":
        projectile({vx:f.facing*680, radius:45, damage:superMove?20:11, returning:true, life:2.4});
        if(superMove) projectile({y:f.y-110,vx:f.facing*750,radius:40,damage:18,returning:true});
        break;
      case "kinetic":
        f.armorTime = superMove ? .8 : .5;
        f.powerState = {kind,remaining:1,clock:0,duration:superMove?.65:.5,
          speed:superMove?1120:850,damage:superMove?29:18,range:115};
        if(superMove) projectile({y:FLOOR-30,vx:f.facing*950,radius:55,damage:18,push:130,level:"low",kind:"shock"});
        break;
      case "sonic":
        projectile({vx:f.facing*780,radius:superMove?115:75,push:superMove?200:120,damage:superMove?30:14});
        break;
      case "codefire":
        projectile({vx:f.facing*620,radius:superMove?70:40,damage:superMove?35:17,explosive:true});
        break;
      default:
        projectile();
    }
  }
  powerConnects(f,target,power){
    const area=[f.x-power.range,f.y-350,power.range*2,400];
    return this.combatBoxes(target).hurt.some(body=>overlap(area,body));
  }
  updatePowerState(f, enemy, dt) {
    const power = f.powerState;
    if (!power) return;
    if (f.health <= 0 || (f.stun > 0 && !f.armorTime)) { f.powerState = null; return; }
    power.clock -= dt;
    if(power.kind === "kinetic") {
      power.duration -= dt;
      f.x = clamp(f.x+f.facing*power.speed*dt,70,WORLD-70);
      if (power.clock <= 0) {
        this.powerEffects.push({kind:"trail",facing:f.facing,x:f.x-f.facing*85,y:f.y-150,color:f.color,life:.12,maxLife:.12});
        power.clock = 1/30;
      }
      if(power.remaining && this.powerConnects(f,enemy,power)) {
        this.hitFighter(f,enemy,power.damage,100,180);
        power.remaining = 0;
      }
      if(power.duration<=0) f.powerState=null;
    } else if(power.kind === "illusion") {
      if(power.clock<=0) {
        if(this.powerConnects(f,enemy,power)) {
          this.hitFighter(f,enemy,power.damage,14,180);
          this.powerEffects.push({kind:"illusion",fighterId:f.id,facing:f.facing,state:f.action || "special",frame:2,x:enemy.x-f.facing*75,y:enemy.y,color:f.color,life:.2,maxLife:.2});
        }
        power.remaining--;
        power.clock=.12;
      }
      if(power.remaining<=0) f.powerState=null;
    }
  }
  updateProjectiles(dt, damageEnabled=true) {
    for (const p of this.projectiles) {
      if (!this.fighters.includes(p.owner)) {p.life=0;continue;}
      p.age = (p.age || 0) + dt;
      if(p.returning && !p.returned && p.age>.55) {
        p.vx *= -1; p.returned=true; p.hitTargets.clear();
      }
      p.x += p.vx * dt;
      p.y += (p.vy || 0) * dt;
      p.life -= dt;
      const target = this.fighters.find(f => f !== p.owner);
      const radius = p.radius || (p.super ? 95 : 55);
      if (damageEnabled && !p.hitTargets?.has(target) && projectileConnects(p,this.combatBoxes(target).hurt,radius)) {
        this.hitFighter(p.owner,target,p.damage ?? (p.super?32:16),p.push ?? (p.super?120:65),
          clamp(target.y-p.y,30,290),{level:p.level||"mid",stun:p.stun});
        p.hitTargets?.add(target);
        if(p.explosive) this.explodeProjectile(p,target);
        if(!p.piercing && !p.returning) p.life=0;
      }
      if(p.explosive && p.life <= 0 && !p.exploded) this.explodeProjectile(p,target,damageEnabled);
      if(p.returned && Math.abs(p.x-p.owner.x)<45) p.life=0;
    }
    this.projectiles = this.projectiles.filter(p => p.life>0 && p.x>-100 && p.x<WORLD+100);
  }
  explodeProjectile(p, target, damageEnabled=true) {
    if (p.exploded) return;
    p.exploded = true;
    const radius = p.super ? 135 : 85;
    this.powerEffects.push({kind:"explosion",x:p.x,y:p.y,color:p.owner.color,life:.5,maxLife:.5,radius});
    this.burst(p.x,p.y,p.owner.color,p.super?42:28);
    if(damageEnabled && !p.hitTargets.has(target) && projectileConnects(p,this.combatBoxes(target).hurt,radius)) {
      this.hitFighter(p.owner,target,p.damage,p.push,clamp(target.y-p.y,30,290));
      p.hitTargets.add(target);
    }
  }
  finishRound() {
    const [a, b] = this.fighters;
    this.roundWinner = a.health === b.health ? -1 : a.health > b.health ? 0 : 1;
    if (this.roundWinner >= 0) this.wins[this.roundWinner]++;
    this.phase = "roundEnd";
    // Let launched powers finish visually before the result screen stops the clock.
    for(const p of this.projectiles)p.life=Math.min(p.life,1.5);
    for(const f of this.fighters){
      f.powerState=null;
      f.armorTime=0;
      // Fighter updates stop during results; settle the damage trail before freezing it.
      f.displayHealth=f.health;
    }
    this.sound("ko",this.fighters[this.roundWinner]);
    this.phaseTime = 3.2;
    if (a.health <= 0) { a.action = null; this.setState(a, "ko"); }
    if (b.health <= 0) { b.action = null; this.setState(b, "ko"); }
    if (this.roundWinner >= 0) {
      const winner = this.fighters[this.roundWinner];
      winner.action = null;
      this.setState(winner, "celebrate");
    }
  }
  draw() {
    const c = this.ctx;
    c.save();
    c.clearRect(0, 0, W, H);
    if (this.shake)
      c.translate(
        (Math.random() - 0.5) * this.shake,
        (Math.random() - 0.5) * this.shake,
      );
    if(this.phase==='intro'){
      const {zoom}=fightIntro(this.phaseTime);
      c.translate(W/2,H/2);c.scale(zoom,zoom);c.translate(-W/2,-H/2);
    }
    this.drawStage(c);
    c.translate(-this.cameraX, 0);
    this.drawPowerReflections(c);
    for (const effect of this.powerEffects || []) if(effect.kind === "trail") this.drawPowerEffect(c,effect);
    for (const f of [...(this.fighters || [])].sort((a, b) => Number(a.health > 0) - Number(b.health > 0) || a.y - b.y))
      this.drawFighter(c, f);
    for (const p of this.projectiles || []) {
      this.drawProjectile(c,p);
      if(this.options.debugHitboxes){c.save();c.strokeStyle='#ff5b6a';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,p.radius||(p.super?95:55),0,Math.PI*2);c.stroke();c.restore();}
    }
    for (const effect of this.powerEffects || []) if(effect.kind !== "trail") this.drawPowerEffect(c,effect);
    for (const p of this.particles || []) {
      c.globalAlpha = clamp(p.life / (p.kind?.startsWith("blood")?p.maxLife*.5:.4), 0, 1);
      c.fillStyle = p.color;
      if(p.kind==="bloodSplash"){
        c.save();c.translate(p.x,p.y);c.rotate(p.vx<0?Math.PI:0);
        const r=p.size*(1+(1-p.life/p.maxLife)*.4);c.beginPath();
        c.moveTo(-r*.3,0);c.bezierCurveTo(-r,-r*.7,r*.2,-r*.9,r*.6,-r*.15);c.bezierCurveTo(r*1.5,-r*.4,r*1.8,-r*.1,r*.5,r*.15);c.bezierCurveTo(r,r*.9,-r*.4,r*.7,-r*.3,0);c.fill();c.restore();
      }else if(p.kind==="blood"){
        c.save();c.translate(p.x,p.y);c.rotate(Math.atan2(p.vy,p.vx));c.beginPath();c.ellipse(0,0,p.size*1.8,p.size*.7,0,0,Math.PI*2);c.fill();
        c.globalAlpha*=.35;c.fillStyle="#e76a64";c.beginPath();c.ellipse(-p.size*.4,-p.size*.2,p.size*.5,p.size*.2,0,0,Math.PI*2);c.fill();c.restore();
      }else c.fillRect(p.x, p.y, p.size * 2, p.size);
    }
    c.globalAlpha = 1;
    c.restore();
    if (!this.fighters) return;
    this.drawHUD(c);
    const introCall=this.phase==='intro'?fightIntro(this.phaseTime).call:null;
    if (introCall)
      this.overlay(
        c,
        introCall==='round' ? (this.mode === "training" ? "TREINO" : `ROUND ${this.round}`) : "LUTEM!",
        introCall==='round' ? "PREPARE-SE" : "",
      );
    if (this.phase === "roundEnd")
      this.overlay(
        c,
        this.fighters.some((f) => f.health <= 0) ? "K.O." : "TIME OVER",
        this.roundWinner < 0
          ? "EMPATE"
          : `${this.fighters[this.roundWinner].name} VENCEU`,
        true,
      );
  }
  drawStage(c) {
    drawArena(c, {
      stage: this.stage,
      cameraX: this.cameraX,
      time: this.elapsed || 0,
      width: W, height: H, floor: FLOOR, worldWidth: WORLD,
      art: this.options.stageArt?.[this.stage],
      crowdArt: this.options.crowdArt,
    });
  }
  neon(c, x, y, text, color, size) {
    c.save();
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 20;
    c.font = `900 ${size}px sans-serif`;
    c.fillText(text, x, y);
    c.restore();
  }
  drawFighter(c, f) {
    const slideFrames=this.assets[f.id]?.slide;
    if(f.id==='devon' && slideFrames?.length){
      for(const copy of f.slideTrail||[]){
        const sprite=slideFrames[animationIndex({...f,state:'slide',stateTime:copy.stateTime,action:null},slideFrames.length,slideFrames.animation?.fps||6,null)];
        if(!sprite?.complete || !sprite.naturalWidth)continue;
        const placement=this.spritePlacement(this.assets[f.id],sprite,PROFILES[f.id].visualHeight||320);
        c.save();c.translate(copy.x,copy.y);c.scale(copy.facing,1);
        c.globalAlpha=.3*Math.pow(copy.life/.38,1.5);
        c.shadowColor='#bd45ee';c.shadowBlur=12;
        c.drawImage(sprite,placement.x,placement.y,placement.width,placement.height);
        c.restore();
      }
    }
    c.save();
    if (f.health > 0) {
      c.save();
      c.translate(f.x, FLOOR + 5);
      c.scale(Math.max(18, 65 - (FLOOR - f.y) / 12), 13);
      const shadow = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      shadow.addColorStop(0, "#02061342");
      shadow.addColorStop(0.45, "#02061329");
      shadow.addColorStop(1, "#02061300");
      c.fillStyle = shadow;
      c.fillRect(-1, -1, 2, 2);
      c.restore();
    }
    const asset = this.assets[f.id] || {},
      aliases = FRAME_ALIASES;
    const available = (value) =>
      Array.isArray(value) ? value.length > 0 : Boolean(value);
    const ownFrames = [asset[f.state], asset[aliases[f.state]]].find(available);
    let frames = ownFrames || asset.idle || [];
    if (!Array.isArray(frames)) frames = [frames];
    const frameIndex=animationIndex(f,frames.length,frames.animation?.fps || (["walk","backwalk"].includes(f.state)?12:6),f.action?moveFor(f,f.action):null);
    const sprite = frames[frameIndex];
    const crouch = ["crouch", "lowBlock", "crouchPunch", "crouchKick", "sweep"].includes(f.state),
      height = crouch && !ownFrames ? 210 : (PROFILES[f.id].visualHeight || 320);
    c.translate(f.x, f.y);
    c.scale(f.state === "turn" ? f.turnFrom : f.facing, 1);
    if (f.state === "ko" && !ownFrames) {
      c.rotate(-1.25);
      c.translate(65, 0);
    }
    if (f.health > 0 && f.stun > 0 && Math.floor(f.stun * 40) % 2) c.globalAlpha = 0.65;
    if (sprite?.complete && sprite.naturalWidth) {
      const placement = this.spritePlacement(asset,sprite,height);
      if(sprite.spriteMeta?.pixelArt ?? (f.id==='joe-munist'))c.imageSmoothingEnabled=false;
      if(f.id==='devon' && f.slide){
        c.shadowColor='#bd45ee';
        c.shadowBlur=f.slide.phase==='travel'?26:14;
      }
      c.drawImage(f===this.fighters[1]&&this.fighters[0].id===f.id?alternateSprite(sprite):sprite,placement.x,placement.y,placement.width,placement.height);
    } else {
      c.fillStyle = f.color;
      c.fillRect(-34, -190, 68, 125);
      c.beginPath();
      c.arc(0, -225, 31, 0, 7);
      c.fill();
      c.fillRect(-32, -75, 24, 75);
      c.fillRect(12, -75, 24, 75);
    }
    if (f.action && frames.length <= 1) {
      c.strokeStyle = f.color;
      c.lineWidth = f.action === "kick" ? 22 : 17;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(10, f.action === "kick" ? -75 : -160);
      c.lineTo(f.action === "kick" ? 138 : 98, -135);
      c.stroke();
    }
    c.restore();
    if(this.options.debugHitboxes){
      const boxes=this.combatBoxes(f);c.save();c.lineWidth=2;
      for(const [kind,color] of [['hurt','#48e59c'],['hit','#ff5b6a']]){
        c.strokeStyle=color;c.fillStyle=kind==='hurt'?'#48e59c18':'#ff5b6a44';
        for(const [x,y,w,h] of boxes[kind]){c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h);}
      }
      c.fillStyle='#fff';c.font='12px monospace';c.textAlign='center';c.fillText(f.state+' · frame '+boxes.frame,f.x,f.y-350);c.restore();
    }
  }
  spritePlacement(asset, sprite, height = 320) {
    const reference = (Array.isArray(asset.idle) ? asset.idle[0] : asset.idle) || sprite;
    const bounds = this.measureSprite(reference);
    const baseDrawHeight = height / (bounds.height / reference.naturalHeight);
    const drawHeight = baseDrawHeight * (sprite.spriteMeta?.scale || 1);
    const drawWidth = drawHeight * sprite.naturalWidth / sprite.naturalHeight;
    const anchorX = sprite.spriteMeta?.anchorX ?? .5;
    const anchorY = sprite.spriteMeta?.anchorY ?? bounds.bottom/reference.naturalHeight;
    return {x:-drawWidth*anchorX,y:-drawHeight*anchorY,width:drawWidth,height:drawHeight};
  }
  hologramSprite(sprite, color) {
    let variants = this.hologramSprites.get(sprite);
    if (!variants) { variants = new Map(); this.hologramSprites.set(sprite,variants); }
    if (variants.has(color)) return variants.get(color);
    const surface = document.createElement("canvas");
    surface.width = sprite.naturalWidth;
    surface.height = sprite.naturalHeight;
    const context = surface.getContext("2d");
    context.drawImage(sprite,0,0);
    // Tint and scanlines are clipped to the sprite's alpha, preserving anatomy.
    context.globalCompositeOperation = "source-atop";
    context.globalAlpha = .6;
    context.fillStyle = color;
    context.fillRect(0,0,surface.width,surface.height);
    context.globalAlpha = .25;
    context.fillStyle = "#e3f4ff";
    for(let y=0;y<surface.height;y+=14)context.fillRect(0,y,surface.width,2);
    variants.set(color,surface);
    return surface;
  }
  measureSprite(sprite) {
    if (this.spriteBounds.has(sprite)) return this.spriteBounds.get(sprite);
    const width = sprite.naturalWidth,
      height = sprite.naturalHeight;
    let top = height,
      bottom = 0;
    try {
      const surface = document.createElement("canvas");
      surface.width = width;
      surface.height = height;
      const context = surface.getContext("2d", { willReadFrequently: true });
      context.drawImage(sprite, 0, 0);
      const pixels = context.getImageData(0, 0, width, height).data;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          if (pixels[(y * width + x) * 4 + 3] > 32) {
            top = Math.min(top, y);
            bottom = Math.max(bottom, y + 1);
          }
        }
    } catch {
      top = 0;
      bottom = height;
    }
    const bounds =
      bottom > top
        ? { height: bottom - top, bottom }
        : { height, bottom: height };
    this.spriteBounds.set(sprite, bounds);
    return bounds;
  }
  arenaPowerColor(color, amount = .16) {
    const ambient = arenaPalette(this.stage).ambient;
    if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
    const mix = [1,3,5].map(index => Math.round(
      parseInt(color.slice(index,index+2),16)*(1-amount)+parseInt(ambient.slice(index,index+2),16)*amount));
    return `#${mix.map(value=>value.toString(16).padStart(2,"0")).join("")}`;
  }
  drawPowerReflections(c) {
    c.save();
    for(const p of this.projectiles || []) {
      const strength = Math.max(0,1-(FLOOR-p.y)/420);
      c.globalAlpha = strength * (this.stage === 1 ? .018 : .045);
      c.fillStyle = this.arenaPowerColor(p.owner.color,.3);
      c.beginPath();c.ellipse(p.x,FLOOR+14,Math.min(56,(p.radius || 30)*.8),2.5,0,0,Math.PI*2);c.fill();
    }
    c.restore();
  }
  drawPowerEffect(c, effect) {
    c.save();
    c.translate(effect.x,effect.y);
    const progress = 1-effect.life/effect.maxLife;
    c.globalAlpha = Math.max(0,effect.life/effect.maxLife)*.6;
    const color = this.arenaPowerColor(effect.color);
    c.strokeStyle = color;
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = 7;
    if(effect.kind === "explosion") {
      const radius = effect.radius*(.3+progress);
      c.lineWidth=8*(1-progress)+2;
      c.beginPath();c.arc(0,0,radius,0,Math.PI*2);c.stroke();
      for(let i=0;i<12;i++) {
        const angle=i*Math.PI/6;
        c.fillRect(Math.cos(angle)*radius-5,Math.sin(angle)*radius-5,10,10);
      }
    } else if(effect.kind === "illusion") {
      const asset = this.assets[effect.fighterId] || {};
      let frames = asset[effect.state] || asset.special || asset.idle || [];
      if(!Array.isArray(frames)) frames=[frames];
      const sprite = frames[Math.min(effect.frame || 0,frames.length-1)];
      if(sprite?.complete && sprite.naturalWidth) {
        const placement = this.spritePlacement(asset,sprite);
        c.scale(effect.facing || 1,1);
        c.shadowBlur = 10;
        c.drawImage(this.hologramSprite(sprite,effect.color),placement.x,placement.y,placement.width,placement.height);
      }
    } else if(effect.kind === "trail") {
      c.scale(effect.facing || 1,1);
      c.globalAlpha *= .25;
      c.shadowBlur = 2;
      c.lineWidth = 2;
      for(const [y,length] of [[-42,48],[0,68],[46,38]]) {
        c.beginPath();c.moveTo(-length,y);c.lineTo(8,y-5);c.stroke();
      }
      c.globalAlpha *= .6;
      c.beginPath();c.ellipse(5,0,16,62,0,1.75,4.5);c.stroke();
    }
    c.restore();
  }
  drawProjectile(c, p) {
    c.save();
    c.translate(p.x, p.y);
    c.scale(Math.sign(p.vx), 1);
    const radius = p.radius || (p.super ? 54 : 30);
    const color = this.arenaPowerColor(p.owner.color);
    c.fillStyle = color;
    c.strokeStyle = color;
    c.shadowColor = color;
    c.shadowBlur = p.super ? 10 : 6;
    c.lineWidth=5;
    switch(p.kind) {
      case "solar":
        c.rotate(p.age*4);c.beginPath();c.arc(0,0,radius*.62,0,Math.PI*2);c.fill();
        for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(Math.cos(a)*radius*.8,Math.sin(a)*radius*.8);c.lineTo(Math.cos(a)*radius*1.25,Math.sin(a)*radius*1.25);c.stroke();}
        break;
      case "pulse":
        c.globalAlpha=.65;c.beginPath();c.ellipse(0,0,radius*1.5,radius*.35,0,0,Math.PI*2);c.fill();
        c.globalAlpha=1;c.beginPath();c.moveTo(-radius*3,0);c.lineTo(radius,0);c.stroke();
        break;
      case "bass":
        for(let i=0;i<3;i++){c.globalAlpha=1-i*.25;c.beginPath();c.ellipse(-i*22,0,radius*.3,radius*(1-i*.2),0,-1.4,1.4);c.stroke();}
        break;
      case "gravity":
        c.rotate(p.age*2);c.globalAlpha=.4;c.beginPath();c.arc(0,0,radius*.7,0,Math.PI*2);c.fill();c.globalAlpha=1;
        for(let i=0;i<3;i++){c.rotate(Math.PI/3);c.beginPath();c.ellipse(0,0,radius,radius*.4,0,0,Math.PI*2);c.stroke();}
        break;
      case "solidarity":
        c.rotate(p.age*3);c.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,r=i%2?radius*.45:radius;c.lineTo(Math.cos(a)*r,Math.sin(a)*r);}c.closePath();c.fill();
        break;
      case "feather":
        c.rotate(p.age*8);c.beginPath();c.moveTo(-radius,0);c.quadraticCurveTo(0,-radius,radius,0);c.quadraticCurveTo(0,radius*.45,-radius,0);c.fill();
        c.strokeStyle="#ffd5df";c.lineWidth=2;c.beginPath();c.moveTo(-radius,0);c.lineTo(radius,0);c.stroke();
        break;
      case "prism":
        c.rotate((p.age||0)*5);
        for(let i=0;i<3;i++) {
          c.strokeStyle=[p.owner.color,"#ff89d0","#92ecff"][i];
          const r=radius-i*6;
          c.beginPath();c.moveTo(r,0);c.lineTo(0,r);c.lineTo(-r,0);c.lineTo(0,-r);c.closePath();c.stroke();
        }
        break;
      case "cubes":
        c.rotate((p.age||0)*2);
        c.globalAlpha=.35;c.fillRect(-radius,-radius,radius*2,radius*2);c.globalAlpha=1;
        c.strokeRect(-radius,-radius,radius*2,radius*2);
        c.strokeRect(-radius*.65,-radius*.65,radius*1.3,radius*1.3);
        c.font="bold 20px monospace";c.textAlign="center";c.fillText("01",0,8);
        break;
      case "runes":
        c.rotate(Math.sin((p.age||0)*5)*.3);
        c.fillRect(-radius*.7,-radius,radius*1.4,radius*2);
        c.strokeStyle="#fff2ce";c.strokeRect(-radius*.7,-radius,radius*1.4,radius*2);
        c.fillStyle="#28203a";c.font="bold 18px monospace";c.textAlign="center";c.fillText("20",0,7);
        break;
      case "lunar":
        for(let i=0;i<5;i++) {
          c.globalAlpha=.17;c.beginPath();c.arc(-i*18,Math.sin(i+p.age*4)*12,radius*(1-i*.08),0,Math.PI*2);c.fill();
        }
        c.globalAlpha=1;c.strokeStyle="#eff2ff";c.beginPath();c.arc(0,0,radius*.55,-1.5,1.5);c.stroke();
        break;
      case "boomerang":
        c.rotate((p.age||0)*13);
        c.fillRect(-radius,-9,radius*2,18);c.fillRect(-9,-radius,18,radius*2);
        c.fillStyle="#eff6ff";c.fillRect(-12,-12,24,24);
        break;
      case "sonic":
        for(let i=0;i<3;i++) {
          c.globalAlpha=1-i*.23;c.beginPath();c.ellipse(-i*26,0,radius*.4,radius*(1-i*.15),0,-1.5,1.5);c.stroke();
        }
        break;
      case "shock":
        c.beginPath();c.moveTo(-radius,15);c.lineTo(-radius*.5,-25);c.lineTo(0,5);c.lineTo(radius*.5,-45);c.lineTo(radius,15);c.stroke();
        break;
      case "codefire":
        for(let i=0;i<12;i++) {
          const x=Math.sin(i*2.9+p.age*4)*radius;
          const y=Math.cos(i*1.7+p.age*3)*radius*.8;
          c.fillStyle=i%3===0?"#fff2a1":i%2?"#ffb146":p.owner.color;
          c.fillRect(x-7-i*4,y-7,14,14);
        }
        break;
      default: {
        const g = c.createRadialGradient(0,0,0,0,0,radius);
        g.addColorStop(0,"#fff");g.addColorStop(.3,color);g.addColorStop(1,"#ffffff00");
        c.fillStyle=g;c.beginPath();c.ellipse(0,0,radius*1.5,radius,0,0,7);c.fill();
        c.globalAlpha=.5;c.fillStyle=color;c.beginPath();c.moveTo(-radius,-radius*.5);c.lineTo(-radius*3,0);c.lineTo(-radius,radius*.5);c.fill();
      }
    }
    c.restore();
  }
  drawHUD(c) {
    c.save();
    // Only values, outlines and lettering are painted; the arena remains visible.
    const label = (text, x, y, font, color = "#fff3d9") => {
      c.font = font;
      c.lineWidth = 3;
      c.strokeStyle = "#160f18";
      c.strokeText(text, x, y);
      c.fillStyle = color;
      c.fillText(text, x, y);
    };
    for (let i = 0; i < 2; i++) {
      const f = this.fighters[i], x = i ? 737 : 55, width = 488;
      const fillValue = (value, y, height, color, barX = x, barWidth = width) => {
        const amount = barWidth * clamp(value / 100, 0, 1);
        c.fillStyle = color;
        c.fillRect(i ? barX + barWidth - amount : barX, y, amount, height);
      };
      c.textAlign = i ? "right" : "left";
      label(f.name.toUpperCase(), i ? x + width : x, 50, "900 25px sans-serif");
      fillValue(f.displayHealth, 62, 26, "#bd6946");
      fillValue(f.health, 62, 26, f.health < 25 ? "#ef745b" : "#ffb522");
      fillValue(f.health, 63, 3, "#ffdf87");
      c.strokeStyle = "#19121c";
      c.lineWidth = 4;
      c.strokeRect(x, 62, width, 26);
      c.strokeStyle = "#ffe2a0";
      c.lineWidth = 1.5;
      c.strokeRect(x, 62, width, 26);
      for (let j = 0; j < 2; j++) {
        const cx = i ? x + width - 8 - j * 24 : x + 8 + j * 24;
        c.beginPath();
        c.moveTo(cx, 100); c.lineTo(cx + 6, 106);
        c.lineTo(cx, 112); c.lineTo(cx - 6, 106); c.closePath();
        if (this.wins[i] > j) { c.fillStyle = "#ffb522"; c.fill(); }
        c.strokeStyle = "#fff0c8"; c.lineWidth = 1.5; c.stroke();
      }
      label(i ? (["arcade","free"].includes(this.mode) ? "CPU" : this.mode === "training" ? "TREINO" : "P2") : "P1", i ? x + width - 55 : x + 55, 111, "700 11px sans-serif", "#edcca1");
      const ex = i ? 945 : 55;
      fillValue(f.energy, 639, 16, f.energy >= 100 ? "#ffb522" : f.color, ex, 280);
      c.strokeStyle = "#19121c"; c.lineWidth = 3; c.strokeRect(ex, 639, 280, 16);
      c.strokeStyle = "#ffe2a0"; c.lineWidth = 1; c.strokeRect(ex, 639, 280, 16);
      for (let j = 1; j < 4; j++) {
        c.beginPath();c.moveTo(ex + j * 70, 639);c.lineTo(ex + j * 70, 655);c.stroke();
      }
      label(f.energy >= 100 ? "SUPER PRONTO" : "ENERGIA", i ? ex + 280 : ex, 632, "800 13px sans-serif", f.energy >= 100 ? "#ffcf67" : "#fff3d9");
      this.drawCombo(c,f,i);
    }
    c.textAlign = "center";
    label(this.mode === "training" ? "∞" : String(Math.ceil(this.timer)).padStart(2, "0"), 640, 84, "900 58px monospace", "#ffcf67");
    if (this.mode !== "training") label("ROUND " + this.round, 640, 109, "800 12px sans-serif");
    c.restore();
  }
  drawCombo(c,f,index) {
    if(f.combo<1||f.comboTime<=0||!['fight','roundEnd'].includes(this.phase))return;
    const age=Math.max(0,1.4-f.comboTime),impact=Math.pow(1-clamp(age/.2,0,1),3);
    c.save();
    // Anchor to screen edges: crossing sides and camera movement never swap owners.
    c.translate(index?W-36:36,240);
    c.scale(1+impact*.16,1+impact*.16);
    c.globalAlpha*=clamp(f.comboTime/.3,0,1);
    c.textAlign=index?'right':'left';c.textBaseline='alphabetic';c.lineJoin='round';
    const ink=c.createLinearGradient(0,-78,0,6);
    ink.addColorStop(0,'#fff3d6');ink.addColorStop(.55,'#ffcf67');ink.addColorStop(1,'#ffb522');
    c.font='italic 900 82px "Barlow Condensed", sans-serif';
    c.strokeStyle='#030712';c.lineWidth=9;c.strokeText(`${f.combo}x`,0,0,180);
    c.fillStyle=ink;c.shadowColor='#ffb522';c.shadowBlur=8+impact*10;
    c.fillText(`${f.combo}x`,0,0,180);c.shadowBlur=0;
    c.font='italic 900 26px "Barlow Condensed", sans-serif';c.lineWidth=5;
    const caption=f.combo===1?'HIT!':'HIT COMBO';
    c.strokeText(caption,0,34,190);c.fillStyle='#fff3d6';c.fillText(caption,0,34,190);
    const direction=index?-1:1;
    c.fillStyle='#ffb522';c.beginPath();
    c.moveTo(0,46);c.lineTo(direction*116,46);c.lineTo(direction*94,51);c.lineTo(0,51);c.closePath();c.fill();
    c.restore();
  }
  overlay(c, title, subtitle, winnerAbove = false) {
    c.save();
    c.textAlign = "center";
    c.font = "italic 900 91px sans-serif";
    c.lineWidth = 8;
    c.strokeStyle = "#141625";
    c.strokeText(title, 640, 330);
    c.fillStyle = "#ffe59c";
    c.shadowColor = "#ff8b57";
    c.shadowBlur = 22;
    c.fillText(title, 640, 330);
    c.shadowBlur = 0;
    c.font = winnerAbove ? "italic 900 32px sans-serif" : "700 23px sans-serif";
    c.fillStyle = "#f3f1eb";
    if(winnerAbove)c.strokeText(subtitle,640,230,1160);
    c.fillText(subtitle, 640, winnerAbove ? 230 : 376, 1160);
    c.restore();
  }
}
