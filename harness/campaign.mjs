import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), ...(detail === undefined ? {} : { detail }) });
}
async function screen(name) {
  await page.waitForFunction(name => window.__ui?.screen === name, name);
}
async function fight() {
  await screen('fight');
  await page.waitForFunction(() => window.__fight?.fighters.length === 2 && window.__fight.running);
}
async function decide(winner) {
  await page.evaluate(winner => {
    const game = window.__fight;
    game.inspectionPaused = false;
    game.paused = false;
    game.phase = 'fight';
    game.hitstop = 0;
    game.wins = winner === 0 ? [1, 0] : [0, 1];
    game.cpu = false;
    game.fighters.forEach((fighter, index) => {
      fighter.health = index === winner ? 100 : 0;
      fighter.action = null; fighter.stun = 0;
    });
  }, winner);
  await page.waitForFunction(() => !document.querySelector('#matchOverlay').hidden, { timeout: 10000 });
  await page.waitForTimeout(100);
}
try {
  await page.goto(process.env.GAME_URL || 'http://localhost:3187');
  await page.waitForFunction(() => window.__ui?.assets && !document.querySelector("#titleStart").disabled);
  check('title is initial game screen', await page.locator('#titleScreen').isVisible());
  await page.keyboard.press('Enter'); await screen('mode');
  check('Enter opens mode select', await page.locator('#modeScreen').isVisible());
  await page.keyboard.press('ArrowRight');
  check('arrow selects local versus', await page.evaluate(() => __ui.selection.mode === 'versus'));
  await page.keyboard.press('ArrowRight');
  check('arrow selects training', await page.evaluate(() => __ui.selection.mode === 'training'));
  await page.keyboard.press('ArrowRight');
  check('mode selection wraps to arcade', await page.evaluate(() => __ui.selection.mode === 'arcade'));
  await page.keyboard.press('Enter'); await screen('fighter');
  await page.keyboard.press('ArrowRight');
  check('arrow changes fighter', await page.evaluate(() => __ui.selection.player === 'bruno'));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); await screen('stage');
  await page.keyboard.press('ArrowRight');
  check('arrow changes arena', await page.evaluate(() => __ui.selection.stage === 1));
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter'); await screen('versus');
  check('versus splash before fight', await page.locator('#versusScreen').isVisible());
  await fight();
  check('campaign starts first arena', await page.evaluate(() => __ui.campaign.index === 0 && __ui.selection.stage === 0));
  for (let index = 0; index < 2; index++) {
    await decide(0);
    check(`arena ${index + 1} win offers next arena`, await page.locator('#nextStageButton').isVisible());
    await page.click('#nextStageButton'); await fight();
    check(`campaign advances to arena ${index + 2}`, await page.evaluate(index => __ui.campaign.index === index + 1 && __ui.selection.stage === index + 1, index));
  }
  await decide(1);
  check('last arena defeat does not advance', !(await page.locator('#nextStageButton').isVisible()));
  check('last arena defeat offers retry', await page.locator('#rematchButton').isVisible());
  check('defeat is not champion', !(await page.locator('#overlayTitle').textContent()).includes('CAMPEÃO'));
  await page.click('#rematchButton'); await fight();
  check('last arena retry preserves campaign index and arena', await page.evaluate(() => __ui.campaign.index === 2 && __ui.selection.stage === 2));
  await decide(0);
  check('third victory crowns champion', (await page.locator('#overlayTitle').textContent()).includes('CAMPEÃO'));
  check('champion has no next arena', !(await page.locator('#nextStageButton').isVisible()));
  await page.screenshot({ path: 'artifacts/campaign-champion.png' });
  await page.click('#rematchButton'); await screen('mode');
  check('champion replay returns mode select', await page.locator('#modeScreen').isVisible());
  check('champion replay resets campaign', await page.evaluate(() => __ui.campaign === null));
  check('no browser runtime errors', errors.length === 0, errors);
} catch (error) {
  check('campaign scenario completed', false, error.stack);
} finally {
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile('artifacts/campaign.json', JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
const failed = checks.filter(check => !check.pass);
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, errors, failures: failed }, null, 2));
if (failed.length) process.exitCode = 1;
