import { access, mkdir, readFile, readdir, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createHash } from 'node:crypto';

const assetNames = { bruno: 'waggy', maya: 'rina-sabre' };
const exists = async path => {
  try { await access(path); return true; } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
};
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const save = async (path, data) => writeFile(path, JSON.stringify(data, null, 2) + '\n');
async function renameHistoryPaths(directory, oldRun, newRun) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await renameHistoryPaths(path, oldRun, newRun);
    else if (entry.isFile() && entry.name.endsWith('.json')) {
      const content = await readFile(path, 'utf8');
      const updated = content.replaceAll(oldRun + '/', newRun + '/').replaceAll(oldRun + '"', newRun + '"');
      if (updated !== content) await writeFile(path, updated);
    }
  }
}

export async function organizeAssets(root = process.cwd()) {
  const manifestPath = join(root, 'assets/manifest.json');
  const manifest = await json(manifestPath);
  const plans = [];
  // Check every source before moving anything. Runtime IDs are preserved for saved selections/audio.
  for (const [id, states] of Object.entries(manifest)) {
    const frames = Object.values(states).flatMap(state => state.frames);
    const directories = new Set(frames.map(frame => dirname(frame.path)));
    if (directories.size !== 1) throw new Error(`${id}: mixed sprite directories`);
    const source = [...directories][0];
    const targetRun = `assets/sprites/${assetNames[id] || id}`;
    const target = `${targetRun}/curated`;
    const sourceRun = dirname(source);
    const archiveRun = sourceRun === `assets/generated/sprites/${id}` && assetNames[id]
      ? `assets/generated/sprites/${assetNames[id]}` : sourceRun;
    if (sourceRun !== archiveRun && await exists(join(root, sourceRun)) && await exists(join(root, archiveRun))) {
      throw new Error(`${id}: renamed generation directory already exists`);
    }
    for (const frame of frames) {
      const destination = frame.path.replace(source + '/', target + '/');
      if (!await exists(join(root, frame.path)) && !await exists(join(root, destination))) {
        throw new Error(`Missing sprite: ${frame.path}`);
      }
    }
    if (source !== target && await exists(join(root, source)) && await exists(join(root, target))) {
      throw new Error(`${id}: destination already exists; resolve duplicate before moving`);
    }
    plans.push({ id, states, source, sourceRun, archiveRun, target, targetRun });
  }
  for (const { id, states, source, sourceRun, archiveRun, target, targetRun } of plans) {
    if (source === target) continue;
    await mkdir(join(root, targetRun), { recursive: true });
    if (await exists(join(root, source))) await rename(join(root, source), join(root, target));
    const rewrite = data => {
      if (typeof data === 'string') return data.startsWith(source + '/') ? data.replace(source + '/', target + '/') : data;
      if (Array.isArray(data)) return data.map(rewrite);
      if (data && typeof data === 'object') return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, rewrite(value)]));
      return data;
    };
    manifest[id] = rewrite(states);
    for (const file of ['sprite-request.json', 'runtime-metrics.json', 'runtime-manifest.json', 'anatomy-annotations.json']) {
      const origin = join(root, sourceRun, file);
      if (!await exists(origin)) continue;
      const data = rewrite(await json(origin));
      // Keep generation metadata usable when inspecting historic runs.
      if (file === 'sprite-request.json' && data.character) data.character.id = assetNames[id] || id;
      await save(origin, data);
      await save(join(root, targetRun, file), data);
    }
    await save(join(root, targetRun, 'runtime-manifest.json'), manifest[id]);
    if (archiveRun !== sourceRun && await exists(join(root, sourceRun))) {
      await rename(join(root, sourceRun), join(root, archiveRun));
      await renameHistoryPaths(join(root, archiveRun), sourceRun, archiveRun);
    }
    await save(join(root, targetRun, 'provenance.json'), { runtimeId: id, assetName: assetNames[id] || id, generationRun: archiveRun });
  }
  for (const [oldFile, newFile] of [
    ['assets/maya-walk-correction.json', 'assets/rina-sabre-walk-correction.json'],
    ['assets/extended-request.json', 'assets/extended-request.json'],
  ]) {
    const oldPath = join(root, oldFile), newPath = join(root, newFile);
    if (!await exists(oldPath)) continue;
    if (oldFile !== newFile && await exists(newPath)) throw new Error(`Recipe already exists: ${newFile}`);
    const recipe = await json(oldPath);
    if (assetNames[recipe.character?.id]) recipe.character.id = assetNames[recipe.character.id];
    await save(oldPath, recipe);
    if (oldFile !== newFile) await rename(oldPath, newPath);
  }
  const temp = manifestPath + '.tmp';
  await save(temp, manifest);
  await rename(temp, manifestPath);
  await consolidateGeneration(root);
  return plans.length;
}

async function files(directory) {
  if (!await exists(directory)) return [];
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Preserve entire generation runs, not just published frames. Verify every move
// before removing its now-empty parent; retain originals of rewritten metadata.
async function consolidateGeneration(root) {
  const batches = ['roster-v7', 'roster-v14', 'roster-pending', 'sprites'];
  const mappings = [];
  const characters = [];
  for (const entry of await readdir(join(root, 'assets/sprites'), { withFileTypes: true })) {
    const canonical = `assets/sprites/${entry.name}`;
    if (!entry.isDirectory() || !await exists(join(root, canonical, 'provenance.json'))) continue;
    const provenance = await json(join(root, canonical, 'provenance.json'));
    const source = provenance.generationRun;
    const batch = source.split('/')[2];
    const destination = source.startsWith('assets/generated/') ? `${canonical}/generation/${batch}` : source;
    if (source !== destination) mappings.push([source, destination]);
    characters.push({ canonical, provenance, source, destination });
  }
  for (const batch of batches) mappings.push([`assets/generated/${batch}`, `assets/sprites/_generation/${batch}`]);
  mappings.sort((a, b) => b[0].length - a[0].length);
  const auditPath = join(root, 'assets/sprites/_generation/migration-audit.json');
  const audit = await exists(auditPath) ? await json(auditPath) : { version: 1, files: [], paths: mappings };
  const move = async (source, destination) => {
    if (source === destination) return;
    if (!await exists(join(root, source))) return;
    if (await exists(join(root, destination))) throw new Error(`Migration collision: ${destination}`);
    const before = [];
    for (const file of await files(join(root, source))) before.push({ source: file.slice(root.length + 1), destination: destination + file.slice(join(root, source).length), sha256: hash(await readFile(file)) });
    await mkdir(join(root, dirname(destination)), { recursive: true });
    await rename(join(root, source), join(root, destination));
    for (const item of before) {
      if (hash(await readFile(join(root, item.destination))) !== item.sha256) throw new Error(`Moved file changed: ${item.source}`);
      audit.files.push(item);
    }
    await mkdir(dirname(auditPath), { recursive: true });
    await save(auditPath, audit);
  };
  for (const character of characters) await move(character.source, character.destination);
  for (const batch of batches) {
    const source = `assets/generated/${batch}`;
    if (await exists(join(root, source))) {
      if ((await readdir(join(root, source))).length) await move(source, `assets/sprites/_generation/${batch}`);
      else await rmdir(join(root, source));
    }
  }
  for (const { canonical, provenance, destination } of characters) {
    const base = join(root, destination, 'base-source.png');
    const target = join(root, canonical, 'base-source.png');
    if (!await exists(base) && !await exists(target)) throw new Error(`Missing canonical generation source: ${base}`);
    if (await exists(base)) {
      if (await exists(target)) {
        if (hash(await readFile(target)) !== hash(await readFile(base))) throw new Error(`Base-source collision: ${target}`);
        await rm(base);
      } else await rename(base, target);
      const item = audit.files.find(item => item.destination === `${destination}/base-source.png`);
      if (item) item.destination = `${canonical}/base-source.png`;
    }
    provenance.generationRun = destination;
    await save(join(root, canonical, 'provenance.json'), provenance);
  }
  for (const file of await files(join(root, 'assets/sprites'))) {
    if (file.includes('/migration-originals/') || file === auditPath || !/\.(json|py|md|txt|log)$/.test(file)) continue;
    const bytes = await readFile(file);
    let text = bytes.toString('utf8');
    for (const [source, destination] of mappings) text = text.replaceAll(source, destination);
    const character = characters.find(({ canonical }) => file.startsWith(join(root, canonical) + '/'));
    if (character && file.endsWith('.json') && file.startsWith(join(root, character.destination) + '/')) text = text.replace(/"base_image":\s*"base-source.png"/g, '"base_image": "../../base-source.png"');
    if (character) text = text.replaceAll(`${character.destination}/base-source.png`, `${character.canonical}/base-source.png`);
    if (character) text = text.replace(/novos-personagens-para-criar\/(?:Criados|Pendentes)\/[^"\n]+\.png/g, `${character.canonical}/base-source.png`);
    const batch = batches.find(batch => file.startsWith(join(root, `assets/sprites/_generation/${batch}`) + '/'));
    if (batch && file.endsWith('.py')) {
      // Batch ROOT now holds shared reports; character runs live separately.
      text = text.replace(/\b(?:ROOT|root)\s*\/\s*fid/g, `(Path('assets/sprites')/fid/'generation'/'${batch}')`);
    }
    if (batch && file.endsWith('.py')) {
      text = text.replaceAll(`Path('assets/sprites/_generation/${batch}')/sys.argv[1]`, `Path('assets/sprites')/sys.argv[1]/'generation'/'${batch}'`);
      text = text.replace("f'novos-personagens-para-criar/Pendentes/{name}.png'", "f'assets/sprites/{fid}/base-source.png'");
    }
    if (batch && file.endsWith('roster.json')) {
      const roster = JSON.parse(text);
      for (const [id, profile] of Object.entries(roster)) {
        if (profile.reference) profile.reference = `assets/sprites/${assetNames[id] || id}/base-source.png`;
        if (profile.source) profile.source = `assets/sprites/${assetNames[id] || id}/base-source.png`;
      }
      text = JSON.stringify(roster, null, 2) + '\n';
    }
    if (text !== bytes.toString('utf8')) {
      const original = `assets/sprites/_generation/migration-originals/${hash(bytes)}${file.slice(file.lastIndexOf('.'))}`;
      await mkdir(join(root, dirname(original)), { recursive: true });
      if (!await exists(join(root, original))) await writeFile(join(root, original), bytes);
      const item = audit.files.find(item => item.destination === file.slice(root.length + 1));
      if (item && !item.original) item.original = original;
      await writeFile(file, text);
    }
  }
  await save(auditPath, audit);
  // Generation artifacts remain immutable in the audit. Source images are editable:
  // retain their migration digest and record later replacements without reverting them.
  for (const item of audit.files) {
    const preserved = join(root, item.original || item.destination);
    const current = hash(await readFile(preserved));
    const expected = item.revisions?.at(-1)?.sha256 || item.sha256;
    if (current === expected) continue;
    if (!item.original && /^assets\/sprites\/[^/]+\/base-source\.png$/.test(item.destination)) {
      (item.revisions ||= []).push({sha256:current,observedAt:new Date().toISOString(),reason:'Source image replaced after migration; current workspace version retained'});
    } else throw new Error(`Historical bytes missing: ${item.source}`);
  }
  await save(auditPath, audit);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Organized sprites for ${await organizeAssets()} fighters in assets/sprites/.`);
}
