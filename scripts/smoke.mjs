import { _electron as electron } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateLibrary } from './generate-library.mjs';
const root = process.cwd();
const output = path.join(root, 'test-results');
await mkdir(output, { recursive: true });
const library = await generateLibrary(path.join(root, 'test-library'));
const userData = path.join(output, `ui-profile-${Date.now()}`);
const env = { ...process.env, SC_TEST_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env, timeout: 30000 });
app.process().stderr.on('data', (data) => process.stderr.write(data));
const page = await app.firstWindow({ timeout: 30000 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function waitSnapshot(predicate, timeout = 180000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const snapshot = await page.evaluate(() => window.sound.snapshot());
    if (predicate(snapshot)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for the library');
}
try {
  await page.getByRole('button', { name: 'Choose Sample Folder' }).waitFor();
  await page.screenshot({ path: path.join(output, '01-landing.png') });
  const preferences = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  );
  assert.equal(preferences.contextIsolation, true);
  assert.equal(preferences.nodeIntegration, false);
  assert.equal(preferences.sandbox, true);
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] });
  }, library);
  await page.getByRole('button', { name: 'Choose Sample Folder' }).click();
  await waitSnapshot((s) => s.progress.phase === 'complete');
  const snapshot = await page.evaluate(() => window.sound.snapshot());
  if (snapshot.progress.failed || snapshot.library.files.length !== 48)
    console.error(JSON.stringify(snapshot.progress, null, 2));
  assert.equal(snapshot.library.files.length, 48);
  assert.equal(snapshot.progress.analyzed, 48);
  assert.equal(snapshot.progress.failed, 0);
  await page.locator('.map-header p').filter({ hasText: '48 visible' }).waitFor();
  const rejected = await page.evaluate(async () => {
    const results = [];
    for (const id of ['../../secrets', 'a'.repeat(32)]) {
      try {
        await window.sound.preview(id);
        results.push(false);
      } catch {
        results.push(true);
      }
    }
    try {
      await window.sound.settings({ ...(await window.sound.snapshot()).settings, volume: 999 });
      results.push(false);
    } catch {
      results.push(true);
    }
    return { results, nodeExposed: typeof window.require !== 'undefined' };
  });
  assert.deepEqual(rejected, { results: [true, true, true], nodeExposed: false });
  const bounds = await page.locator('.universe').boundingBox();
  const camera = new THREE.PerspectiveCamera(48, bounds.width / bounds.height, 0.1, 1500);
  camera.position.set(12, 18, 165);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const point = snapshot.library.points[0];
  const screen = new THREE.Vector3(point.x, point.y, point.z).project(camera);
  const x = bounds.x + ((screen.x + 1) / 2) * bounds.width;
  const y = bounds.y + ((1 - screen.y) / 2) * bounds.height;
  await page.mouse.move(x, y);
  await page.locator('.star-tooltip').waitFor({ timeout: 5000 });
  await page.mouse.click(x, y);
  await page.locator('.inspector').waitFor();
  await page.getByRole('button', { name: 'Close inspector' }).click();
  const canvasBefore = await page.locator('.universe canvas').screenshot();
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, -220);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let n = 0;
        const frame = () => (++n > 30 ? resolve(null) : requestAnimationFrame(frame));
        requestAnimationFrame(frame);
      }),
  );
  const canvasAfter = await page.locator('.universe canvas').screenshot();
  assert.equal(canvasBefore.equals(canvasAfter), false, 'Zoom changes the rendered constellation');
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.getByRole('button', { name: 'Toggle sound list' }).click();
  await page.getByRole('region', { name: 'Sound results' }).getByRole('button').first().click();
  await page.waitForFunction(
    () => document.querySelector('.now-playing .eyebrow')?.textContent !== 'LOADING PREVIEW',
  );
  await page.getByRole('button', { name: 'Toggle sound list' }).click();
  await page.screenshot({ path: path.join(output, '02-constellation.png') });
  assert.equal(await page.locator('.inspector').count(), 1);
  assert.equal(await page.locator('.neighbour-list>button').count(), 5);
  await page.getByRole('button', { name: 'Loop previews', exact: true }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.getByRole('button', { name: 'Pause preview' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Stop preview' }).click();
  await page.getByRole('textbox', { name: 'Search sounds' }).fill('Hat_');
  assert.equal(
    await page.getByRole('region', { name: 'Sound results' }).getByRole('button').count(),
    8,
  );
  await page.getByRole('region', { name: 'Sound results' }).getByRole('button').first().click();
  await page.getByRole('combobox', { name: 'Duration filter' }).selectOption('short');
  const shown = await page.locator('.map-header p').innerText();
  assert.match(shown, /32 visible/);
  await page.getByRole('combobox', { name: 'File format' }).selectOption('flac');
  await page.getByText('No sounds in this view', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Show all sounds' }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('dialog').waitFor();
  await page.screenshot({ path: path.join(output, '03-settings.png') });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Rescan library' }).click();
  await waitSnapshot((s) => s.progress.phase === 'complete' && s.progress.cached === 48, 30000);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1000, 700));
  await page.screenshot({ path: path.join(output, '04-compact.png') });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await writeFile(
    path.join(output, 'ui-results.json'),
    JSON.stringify(
      {
        testedAt: new Date().toISOString(),
        files: snapshot.library.files.length,
        security: {
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          invalidIdsAndSettingsRejected: true,
        },
        rendererErrors: errors,
        checks: [
          'launch',
          'folder picker IPC',
          'analysis',
          'WebGL hover and star click',
          'zoom changes rendering',
          'selection',
          'five neighbours',
          'preview start/stop',
          'search',
          'duration and format filters',
          '2D',
          'settings',
          'rescan cache hits',
          '1000x700 layout',
        ],
      },
      null,
      2,
    ),
  );
  console.log('Electron smoke tests passed. Screenshots saved to test-results.');
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') });
  console.error(await page.locator('body').innerText());
  throw error;
} finally {
  await app.close();
}
