import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { organizeAssets } from './organize-assets.mjs';

const root = await mkdtemp(join(tmpdir(), 'fight-assets-'));
try {
  const old = 'assets/generated/sprites/bruno';
  await mkdir(join(root, old, 'curated'), { recursive: true });
  await writeFile(join(root, old, 'curated/idle-frame-0.png'), 'unchanged sprite bytes');
  const frame = { path: `${old}/curated/idle-frame-0.png`, scale: 1.23, anchorX: .5, anchorY: .99 };
  const states = { idle: { frames: [frame], fps: 6, loop: true } };
  await writeFile(join(root, old, 'base-source.png'), 'source image bytes');
  await writeFile(join(root, old, 'sprite-request.json'), JSON.stringify({ character: { id: 'bruno' }, states: { idle: { frames: 1, fps: 6, loop: true } } }));
  await writeFile(join(root, old, 'runtime-metrics.json'), JSON.stringify({ idle: [frame] }));
  await writeFile(join(root, 'assets/manifest.json'), JSON.stringify({ bruno: states }));
  await organizeAssets(root);
  const manifest = JSON.parse(await readFile(join(root, 'assets/manifest.json'), 'utf8'));
  const moved = manifest.bruno.idle.frames[0];
  assert.equal(moved.path, 'assets/sprites/waggy/curated/idle-frame-0.png');
  assert.deepEqual({ ...moved, path: frame.path }, frame, 'geometry must remain byte-for-byte equivalent');
  assert.equal(await readFile(join(root, moved.path), 'utf8'), 'unchanged sprite bytes');
  await assert.rejects(access(join(root, old, 'curated')), 'published sprites must move out of generation history');
  await assert.rejects(access(join(root, old)), 'provisional generation directory must be renamed');
  await access(join(root, 'assets/sprites/waggy/generation/sprites/sprite-request.json'));
  assert.equal(JSON.parse(await readFile(join(root, 'assets/sprites/waggy/sprite-request.json'), 'utf8')).character.id, 'waggy');
  assert.equal(await readFile(join(root, 'assets/sprites/waggy/base-source.png'), 'utf8'), 'source image bytes');
  await assert.rejects(access(join(root, 'assets/sprites/waggy/generation/sprites/base-source.png')));
  const audit = JSON.parse(await readFile(join(root, 'assets/sprites/_generation/migration-audit.json'), 'utf8'));
  assert.ok(audit.files.some(file => file.destination === 'assets/sprites/waggy/base-source.png'));
  const once = await readFile(join(root, 'assets/manifest.json'), 'utf8');
  await organizeAssets(root);
  assert.equal(await readFile(join(root, 'assets/manifest.json'), 'utf8'), once, 'migration must be safe to rerun');
  await writeFile(join(root, 'assets/sprites/waggy/base-source.png'), 'user updated source image');
  await organizeAssets(root);
  assert.equal(await readFile(join(root, 'assets/sprites/waggy/base-source.png'), 'utf8'), 'user updated source image', 'reruns must retain updated source images');
  const updatedAudit=JSON.parse(await readFile(join(root, 'assets/sprites/_generation/migration-audit.json'), 'utf8'));
  const originalSource=audit.files.find(file=>file.destination==='assets/sprites/waggy/base-source.png');
  const updatedSource=updatedAudit.files.find(file=>file.destination==='assets/sprites/waggy/base-source.png');
  assert.equal(updatedSource.sha256,originalSource.sha256,'keep the original migration digest');
  assert.equal(updatedSource.revisions.length,1,'record subsequent source replacement separately');
  await organizeAssets(root);
  const repeatedAudit=JSON.parse(await readFile(join(root, 'assets/sprites/_generation/migration-audit.json'), 'utf8'));
  assert.equal(repeatedAudit.files.find(file=>file.destination==='assets/sprites/waggy/base-source.png').revisions.length,1,'unchanged sources do not add revisions');
  console.log('Asset consolidation preserves sprite bytes, runtime IDs, geometry, and reruns safely.');
} finally {
  await rm(root, { recursive: true, force: true });
}
