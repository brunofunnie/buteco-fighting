import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as model from '../src/arcade-run.js';
const ids = ['player', 'a', 'b', 'c', 'd', 'e', 'f', 'devon'];
const create = (options = {}) => model.createArcadeRun({ player: 'player', fighterIds: ids, random: () => 0, ...options });

test('chooses five unique rivals, excludes player and boss, preserves input', () => {
  assert.equal(typeof model.createArcadeRun, 'function');
  const source = [...ids, 'a'];
  const run = create({ fighterIds: source });
  assert.deepEqual(source, [...ids, 'a']);
  assert.deepEqual(run.opponents, ['b', 'c', 'd', 'e', 'f', 'devon']);
  assert.equal(new Set(run.opponents).size, 6);
  assert.equal(run.index, 0);
  assert.deepEqual(run.defeated, []);
  assert.equal(run.complete, false);
});

test('cycles six arenas starting from selected arena', () => {
  assert.deepEqual(create({ stage: 3 }).stages, [3, 0, 1, 2, 3, 0]);
  assert.deepEqual(create({ stage: 2, stageCount: 3 }).stages, [2, 0, 1, 2, 0, 1]);
});

test('only current opponent wins advance; stale wins do not skip matches', () => {
  const run = create();
  const original = structuredClone(run);
  assert.equal(model.winArcadeMatch(run, 'devon'), false);
  assert.deepEqual(run, original);
  assert.equal(model.winArcadeMatch(run, 'b'), true);
  assert.equal(run.index, 1);
  assert.deepEqual(run.defeated, ['b']);
  assert.equal(model.winArcadeMatch(run, 'b'), false);
  assert.equal(run.index, 1);
});

test('reports defeated rivals, remaining rivals, and unlocked final boss through all six wins', () => {
  const run = create();
  let progress = model.arcadeProgress(run);
  assert.equal(progress.defeatedRivals, 0);
  assert.equal(progress.remainingRivals, 5);
  assert.equal(progress.currentIsBoss, false);
  assert.deepEqual(progress.opponents.map(({ status }) => status), ['current', 'waiting', 'waiting', 'waiting', 'waiting', 'waiting']);
  for (const id of ['b', 'c', 'd', 'e', 'f']) assert.equal(model.winArcadeMatch(run, id), true);
  progress = model.arcadeProgress(run);
  assert.equal(progress.defeatedRivals, 5);
  assert.equal(progress.remainingRivals, 0);
  assert.equal(progress.currentIsBoss, true);
  assert.deepEqual(progress.opponents[5], { id: 'devon', status: 'current', boss: true });
  assert.equal(model.winArcadeMatch(run, 'devon'), true);
  assert.equal(run.index, 5);
  assert.equal(run.complete, true);
  assert.deepEqual(run.defeated, ['b', 'c', 'd', 'e', 'f', 'devon']);
  const completed = structuredClone(run);
  assert.equal(model.winArcadeMatch(run, 'devon'), false);
  assert.deepEqual(run, completed);
  progress = model.arcadeProgress(run);
  assert.equal(progress.complete, true);
  assert.equal(progress.currentIsBoss, false);
  assert.ok(progress.opponents.every(({ status }) => status === 'defeated'));
});

test('loss or draw leaves progression available for the same rematch', () => {
  const run = create();
  const before = structuredClone(run);
  model.arcadeProgress(run);
  assert.deepEqual(run, before);
  assert.equal(model.winArcadeMatch(run, run.opponents[0]), true);
});

test('rejects malformed selection and insufficient unique rivals', () => {
  for (const options of [
    { fighterIds: ['player', 'a', 'b', 'c', 'd', 'd', 'devon'] },
    { fighterIds: null }, { player: 'devon' }, { player: 'missing' },
    { stage: -1 }, { stage: 4 }, { stage: 1.2 },
    { stageCount: 0 }, { stageCount: 2.5 }, { random: null },
    { random: () => 1 }, { random: () => -0.1 }, { random: () => NaN },
    { fighterIds: [...ids, 123] },
  ]) assert.throws(() => create(options));
});

test('selected rival opens the route without repeats, followed by four rivals and Devon', () => {
  for(const firstRival of ['a','f']){
    const run=create({firstRival});
    assert.equal(run.opponents[0],firstRival);
    assert.equal(run.opponents.length,6);
    assert.equal(new Set(run.opponents).size,6);
    assert.equal(run.opponents[5],'devon');
  }
  for(const firstRival of ['player','devon','missing'])assert.throws(()=>create({firstRival}));
});

test('dedicated boss arena is exclusive to the final confrontation',()=>{
 const run=create({firstRival:'a',stage:2,stageCount:4,bossStage:4});
 assert.deepEqual(run.stages,[2,3,0,1,2,4]);
 for(const bossStage of [-1,1.5])assert.throws(()=>create({bossStage}));
});


test('random arcade arenas ignore the last selected stage and preserve the boss lair', () => {
  const run = create({stage:3,randomStages:true,bossStage:4,random:()=>.51});
  assert.deepEqual(run.stages,[2,2,2,2,2,4]);
});
