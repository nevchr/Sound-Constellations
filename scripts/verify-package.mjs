import { _electron as electron } from 'playwright';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const output = path.resolve('test-results');
const roots = [path.join(output, 'benchmark-5000/samples')];
const profile = path.join(output, 'benchmark-5000');
const packaged = process.argv.includes('--packaged');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const executablePath = packaged
  ? path.resolve(packageJson.build.directories.output, 'win-unpacked/Sound Constellations.exe')
  : undefined;
const app = await electron.launch({
  executablePath,
  args: [...(packaged ? [] : ['.']), `--user-data-dir=${profile}`],
  env,
  timeout: 30000,
});
const page = await app.firstWindow({ timeout: 30000 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function ready(count) {
  for (let tries = 0; tries < 600; tries++) {
    const s = await page.evaluate(() => window.sound.snapshot());
    if (s.progress.phase === 'complete' && s.library.files.length === count) return s;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Library did not load');
}
try {
  const started = performance.now();
  const snapshot = await ready(5000);
  const loadSeconds = (performance.now() - started) / 1000;
  assert.equal(snapshot.progress.cached, 5000);
  assert.equal(snapshot.progress.analyzed, 0);
  await page.locator('.map-header p').filter({ hasText: '5,000 visible' }).waitFor();
  const timing = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const intervals = [];
        let previous = performance.now();
        function frame(now) {
          intervals.push(now - previous);
          previous = now;
          if (intervals.length < 180) requestAnimationFrame(frame);
          else {
            intervals.sort((a, b) => a - b);
            resolve({ medianMs: intervals[90], p95Ms: intervals[171], frames: intervals.length });
          }
        }
        requestAnimationFrame(frame);
      }),
  );
  const searchStart = performance.now();
  await page.getByRole('textbox', { name: 'Search sounds' }).fill('Kick_');
  await page.getByRole('region', { name: 'Sound results' }).getByRole('button').first().waitFor();
  const searchMs = performance.now() - searchStart;
  await page.getByRole('button', { name: 'Loop previews', exact: true }).click();
  await page.getByRole('region', { name: 'Sound results' }).getByRole('button').first().click();
  await page.locator('.inspector').waitFor();
  await page
    .getByRole('button', { name: 'Pause preview', exact: true })
    .waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Stop preview' }).click();
  await page.getByRole('button', { name: 'Reset view' }).click();
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let count = 0;
        const frame = () => (++count === 90 ? resolve(null) : requestAnimationFrame(frame));
        requestAnimationFrame(frame);
      }),
  );
  await page.screenshot({
    path: path.join(output, packaged ? '05-packaged-5000.png' : '05-renderer-5000.png'),
  });
  const safety = await app.evaluate(({ app, BrowserWindow }) => ({
    packaged: app.isPackaged,
    profile: app.getPath('userData'),
    secure: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().contextIsolation,
  }));
  assert.equal(safety.packaged, packaged);
  assert.equal(path.resolve(safety.profile), profile);
  assert.equal(safety.secure, true);
  assert.deepEqual(errors, []);
  const settings = { ...snapshot.settings, volume: 0.42, neighbours: 7 };
  await page.evaluate((value) => window.sound.settings(value), settings);
  await page.reload();
  const persisted = await page.evaluate(() => window.sound.snapshot());
  assert.equal(persisted.settings.volume, 0.42);
  assert.equal(persisted.settings.neighbours, 7);
  const result = {
    testedAt: new Date().toISOString(),
    packaged,
    sounds: 5000,
    cached: snapshot.progress.cached,
    startupScanSeconds: loadSeconds,
    rendering: timing,
    searchMs,
    packagedDecoderPlaybackStarted: true,
    settingsPersistedAfterRendererReload: true,
    rendererErrors: errors,
  };
  await writeFile(
    path.join(output, packaged ? 'package-results.json' : 'renderer-benchmark-results.json'),
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await app.close();
}
// Reopen the actual process to prove SQLite and settings survive application exit.
const reopened = await electron.launch({
  executablePath,
  args: [...(packaged ? [] : ['.']), `--user-data-dir=${profile}`],
  env,
  timeout: 30000,
});
try {
  const window = await reopened.firstWindow({ timeout: 30000 });
  let snapshot;
  for (let attempt = 0; attempt < 300; attempt++) {
    snapshot = await window.evaluate(() => window.sound.snapshot());
    if (snapshot.progress.phase === 'complete') break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(snapshot.settings.volume, 0.42);
  assert.equal(snapshot.settings.neighbours, 7);
  assert.equal(snapshot.progress.cached, 5000);
  assert.equal(snapshot.progress.analyzed, 0);
  console.log('Process relaunch: 5,000 cache hits and settings preserved.');
} finally {
  await reopened.close();
}
