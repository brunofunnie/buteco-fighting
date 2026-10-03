const BOSS_ID = 'devon';
const RIVAL_COUNT = 5;

/** Build an independent six-match route from the current playable roster. */
export function createArcadeRun({ player, firstRival, bossStage, stage = 0, fighterIds, stageCount = 4, randomStages = false, random = Math.random }) {
  if (!Array.isArray(fighterIds) || fighterIds.some(id => typeof id !== 'string' || !id.trim())) {
    throw new TypeError('fighterIds must contain fighter IDs');
  }
  if (player === BOSS_ID || !fighterIds.includes(player)) {
    throw new RangeError('Arcade player must be a playable fighter');
  }
  if (!Number.isInteger(stageCount) || stageCount < 1 || !Number.isInteger(stage) || stage < 0 || stage >= stageCount) {
    throw new RangeError('Arcade arena must be within stageCount');
  }
  if(bossStage!==undefined && (!Number.isInteger(bossStage)||bossStage<0))throw new RangeError('Boss arena must be a nonnegative integer');
  if (typeof random !== 'function') throw new TypeError('random must be a function');
  const candidates = [...new Set(fighterIds)].filter(id => id !== player && id !== BOSS_ID);
  if(firstRival!==undefined && !candidates.includes(firstRival))throw new RangeError('First rival must be a playable opponent distinct from the player');
  if (candidates.length < RIVAL_COUNT) throw new RangeError('Arcade needs at least five unique rivals');
  for (let i = candidates.length - 1; i > 0; i--) {
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new RangeError('random must return a number in [0, 1)');
    const j = Math.floor(roll * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return {
    index: 0,
    defeated: [],
    opponents: [...(firstRival===undefined ? candidates.slice(0,RIVAL_COUNT) : [firstRival,...candidates.filter(id=>id!==firstRival).slice(0,RIVAL_COUNT-1)]), BOSS_ID],
    stages: Array.from({ length: RIVAL_COUNT + 1 }, (_, index) => index===RIVAL_COUNT && bossStage!==undefined ? bossStage : randomStages ? Math.floor(random() * stageCount) : (stage + index) % stageCount),
    complete: false,
  };
}

/** Record one victory against the current opponent; stale callbacks are harmless. */
export function winArcadeMatch(run, opponent) {
  if (run.complete || run.opponents[run.index] !== opponent || run.defeated.includes(opponent)) return false;
  run.defeated.push(opponent);
  if (run.index === run.opponents.length - 1) run.complete = true;
  else run.index++;
  return true;
}

/** Read-only presentation data for the route and the boss gate. */
export function arcadeProgress(run) {
  const defeatedRivals = run.defeated.filter(id => id !== BOSS_ID).length;
  return {
    opponents: run.opponents.map((id, index) => ({
      id,
      status: run.defeated.includes(id) ? 'defeated' : !run.complete && index === run.index ? 'current' : 'waiting',
      boss: id === BOSS_ID,
    })),
    defeatedRivals,
    remainingRivals: RIVAL_COUNT - defeatedRivals,
    complete: run.complete,
    currentIsBoss: !run.complete && run.opponents[run.index] === BOSS_ID,
  };
}
