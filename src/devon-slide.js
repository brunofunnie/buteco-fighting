/** Stateless combat helpers: only the supplied Devon fighter is mutated. */
export const SLIDE = Object.freeze({startup:.18,travel:.30,recovery:.25,cooldown:3,cost:25,range:420,separation:110});
const MIN_SEPARATION = 88;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const defaults = ({minX=70,maxX=1850,floor=590}={}) => ({minX,maxX,floor});

// Project onto the nearest legal side. Prefer the original motion path when
// interrupted, but permit another arena side when the opponent blocks it all.
function safePosition(x, enemyX, bounds, path=null) {
  const candidates = (lo,hi) => {
    if (lo>hi) return [];
    const result=[];
    const left=Math.min(hi,enemyX-MIN_SEPARATION);
    const right=Math.max(lo,enemyX+MIN_SEPARATION);
    if(left>=lo) result.push(clamp(x,lo,left));
    if(right<=hi) result.push(clamp(x,right,hi));
    return result;
  };
  let choices=path ? candidates(Math.max(bounds.minX,path[0]),Math.min(bounds.maxX,path[1])) : [];
  if(!choices.length) choices=candidates(bounds.minX,bounds.maxX);
  return choices.sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0];
}

export function startDevonSlide(f,enemy,options={}) {
  const {minX,maxX,floor}=defaults(options);
  if(f.id!=='devon' || !(f.health>0) || f.y!==floor || f.stun>0 || f.knockdown>0 || f.action || f.slide || f.slideCooldown>0 || !(f.energy>=SLIDE.cost)) return false;
  if(!Number.isFinite(f.x) || !Number.isFinite(enemy.x) || minX>=maxX || f.x<minX || f.x>maxX || Math.abs(enemy.x-f.x)>SLIDE.range) return false;
  const direction=Math.sign(enemy.x-f.x) || f.facing || 1;
  let destination=enemy.x+direction*SLIDE.separation;
  if(destination<minX || destination>maxX) destination=enemy.x-direction*SLIDE.separation;
  if(destination<minX || destination>maxX || Math.abs(destination-f.x)<1e-6) return false;
  f.energy-=SLIDE.cost;
  f.slideCooldown=SLIDE.cooldown;
  f.slide={phase:'startup',elapsed:0,sourceX:f.x,destinationX:destination,direction};
  return true;
}

/** Cooldown belongs to the game update; this function never decrements it.
 * `traveling` describes the phase after this tick, so body pushing may be
 * bypassed only while it is true. Hits/actions cancel before any travel.
 */
export function tickDevonSlide(f,enemy,dt,options={}) {
  const bounds=defaults(options), s=f.slide;
  const result={active:false,traveling:false,finished:false,cancelled:false};
  if(!s) return result;
  const settle=(x,path=null)=> {
    const safe=safePosition(x,enemy.x,bounds,path);
    f.x=safe===undefined ? clamp(x,bounds.minX,bounds.maxX) : safe;
    f.facing=Math.sign(enemy.x-f.x) || f.facing || 1;
  };
  if(f.stun>0 || f.knockdown>0 || !(f.health>0) || f.action) {
    settle(f.x,[Math.min(s.sourceX,s.destinationX),Math.max(s.sourceX,s.destinationX)]);
    f.slide=null; result.cancelled=true; return result;
  }
  s.elapsed+=Number.isFinite(dt) ? Math.max(0,dt) : 0;
  const travelEnd=SLIDE.startup+SLIDE.travel;
  if(s.elapsed<SLIDE.startup) {
    s.phase='startup';
  } else if(s.elapsed<travelEnd-1e-9) {
    s.phase='travel';
    const progress=clamp((s.elapsed-SLIDE.startup)/SLIDE.travel,0,1);
    f.x=clamp(s.sourceX+(s.destinationX-s.sourceX)*progress,bounds.minX,bounds.maxX);
  } else {
    if(s.phase!=='recovery') settle(s.destinationX);
    s.phase='recovery';
    if(s.elapsed>=travelEnd+SLIDE.recovery-1e-9) {
      // Revalidate once more in case the enemy moved during recovery.
      settle(f.x); f.slide=null; result.finished=true; return result;
    }
  }
  result.active=true; result.traveling=s.phase==='travel';
  return result;
}
