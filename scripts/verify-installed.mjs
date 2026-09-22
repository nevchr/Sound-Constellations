import { _electron as electron, chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, stat, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { generateLibrary } from './generate-library.mjs';
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const output = path.resolve(pkg.build.directories.output);
const reportDir = path.resolve('test-results');
await mkdir(reportDir, { recursive: true });
const qaRoot = await mkdtemp(path.join(os.tmpdir(), 'SoundConstellations-QA-'));
const installDir = path.join(qaRoot, 'app');
const profile = path.join(qaRoot, 'profile');
const library = await generateLibrary(path.join(qaRoot, 'samples'), 12);
const setup = path.join(output, `Sound-Constellations-Setup-${pkg.version}-x64.exe`);
const portable = path.join(output, `Sound-Constellations-Portable-${pkg.version}-x64.exe`);
const shell = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
function powershell(code) {
  return execFileSync(shell, ['-NoProfile', '-NonInteractive', '-Command', code], {
    encoding: 'utf8',
    windowsHide: true,
  }).trim();
}
function registrations() {
  const data = powershell(
    "@(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq 'Sound Constellations' } | Select-Object DisplayName,DisplayVersion,InstallLocation,UninstallString,PSChildName) | ConvertTo-Json -Compress",
  );
  return data ? [JSON.parse(data)].flat() : [];
}
assert.equal(registrations().length, 0, 'Refusing to replace an existing installation');
assert.equal(
  powershell("@(Get-Process -Name 'Sound Constellations' -ErrorAction SilentlyContinue).Count"),
  '0',
  'Close Sound Constellations before running installer lifecycle tests',
);
async function processExit(executable, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      windowsHide: true,
      windowsVerbatimArguments: true,
      stdio: 'ignore',
    });
    child.on('error', reject);
    child.on('close', resolve);
  });
}
const installCode = await processExit(setup, ['/S', '/currentuser', `/D=${installDir}`]);
assert.equal(installCode, 0);
const installedExe = path.join(installDir, 'Sound Constellations.exe');
await access(installedExe);
const registered = registrations();
assert.equal(registered.length, 1);
assert.equal(registered[0].DisplayVersion, pkg.version);
assert.ok(registered[0].UninstallString.toLowerCase().includes(installDir.toLowerCase()));
const startMenu = path.join(
  process.env.APPDATA,
  'Microsoft/Windows/Start Menu/Programs/Sound Constellations.lnk',
);
await access(startMenu);
const desktop = powershell("[Environment]::GetFolderPath('Desktop')");
await access(path.join(desktop, 'Sound Constellations.lnk'));
const cleanEnv = {
  ...process.env,
  PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}`,
  NODE_PATH: '',
};
for (const key of [
  'ELECTRON_RUN_AS_NODE',
  'FFMPEG_BIN',
  'NODE_OPTIONS',
  'SC_DEV_URL',
  'SC_TEST_LIBRARY',
  'SC_TEST_USER_DATA',
])
  delete cleanEnv[key];
await mkdir(profile, { recursive: true });
await writeFile(
  path.join(profile, 'preferences.json'),
  JSON.stringify({
    roots: [library],
    settings: {
      volume: 0.25,
      autoplay: true,
      loop: true,
      pointSize: 1,
      glow: 0.7,
      lines: true,
      neighbours: 5,
      maxAnalysisSeconds: 12,
      hidden: false,
      quality: 'medium',
    },
  }),
);
async function waitForLibrary(page) {
  for (let attempt = 0; attempt < 600; attempt++) {
    const state = await page.evaluate(() => window.sound.snapshot());
    if (state.progress.phase === 'complete') return state;
    if (state.progress.phase === 'error') throw new Error(state.progress.message);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Installed app did not finish its analysis');
}
const application = await electron.launch({
  executablePath: installedExe,
  args: [`--user-data-dir=${profile}`],
  env: cleanEnv,
  timeout: 30000,
});
let installedResult;
try {
  const page = await application.firstWindow({ timeout: 30000 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const state = await waitForLibrary(page);
  assert.equal(state.library.files.length, 12);
  assert.equal(state.progress.analyzed, 12);
  assert.equal(state.progress.failed, 0);
  await page.getByRole('button', { name: 'Toggle sound list' }).click();
  await page.getByRole('region', { name: 'Sound results' }).getByRole('button').first().click();
  await page
    .getByRole('button', { name: 'Pause preview', exact: true })
    .waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Stop preview' }).click();
  await page.getByRole('button', { name: 'Toggle sound list' }).click();
  await page.screenshot({ path: path.join(reportDir, 'installed-application.png') });
  const runtime = await application.evaluate(({ app }) => ({
    executable: process.execPath,
    packaged: app.isPackaged,
    node: process.versions.node,
    electron: process.versions.electron,
    path: process.env.PATH,
  }));
  assert.equal(runtime.packaged, true);
  assert.equal(path.resolve(runtime.executable), installedExe);
  assert.deepEqual(errors, []);
  installedResult = {
    analyzed: state.progress.analyzed,
    previewStarted: true,
    runtime,
    rendererErrors: errors,
  };
} finally {
  await application.close();
}
const reopened = await electron.launch({
  executablePath: installedExe,
  args: [`--user-data-dir=${profile}`],
  env: cleanEnv,
  timeout: 30000,
});
try {
  const page = await reopened.firstWindow();
  const state = await waitForLibrary(page);
  assert.equal(state.progress.cached, 12);
  assert.equal(state.progress.analyzed, 0);
} finally {
  await reopened.close();
}
const uninstall = path.join(installDir, 'Uninstall Sound Constellations.exe');
await access(uninstall);
// The installer was created by this test in an explicitly checked temporary path.
assert.ok(path.resolve(installDir).startsWith(path.resolve(qaRoot) + path.sep));
assert.ok(qaRoot.startsWith(path.join(os.tmpdir(), 'SoundConstellations-QA-')));
const uninstallCode = await processExit(uninstall, ['/S']);
assert.equal(uninstallCode, 0);
let removed = false;
for (let attempt = 0; attempt < 200; attempt++) {
  try {
    await access(installedExe);
  } catch {
    removed = true;
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.equal(removed, true);
// NSIS's temporary uninstaller can finish registry cleanup after the application files disappear.
for (let attempt = 0; attempt < 50 && registrations().length; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.equal(registrations().length, 0);
await access(path.join(profile, 'analysis.sqlite'));
await access(path.join(profile, 'preferences.json'));
for (const shortcut of [startMenu, path.join(desktop, 'Sound Constellations.lnk')]) {
  await assert.rejects(access(shortcut));
}
// Launch the portable wrapper with a Chromium debugging endpoint; it forwards arguments to its bundled Electron child.
const portableProfile = path.join(qaRoot, 'portable-profile');
await mkdir(portableProfile);
await writeFile(
  path.join(portableProfile, 'preferences.json'),
  await readFile(path.join(profile, 'preferences.json')),
);
const wrapper = spawn(
  portable,
  [`--user-data-dir=${portableProfile}`, '--remote-debugging-port=0'],
  { env: cleanEnv, windowsHide: true, stdio: 'ignore' },
);
const wrapperDone = new Promise((resolve, reject) => {
  wrapper.on('error', reject);
  wrapper.on('close', resolve);
});
let port;
for (let attempt = 0; attempt < 900; attempt++) {
  try {
    port = Number(
      (await readFile(path.join(portableProfile, 'DevToolsActivePort'), 'utf8')).split('\n')[0],
    );
    if (port) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
assert.ok(port, 'Portable app did not open its local debugging endpoint');
const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
const page =
  browser
    .contexts()[0]
    .pages()
    .find((p) => p.url().startsWith('app://')) ?? browser.contexts()[0].pages()[0];
let portableResult;
try {
  const state = await waitForLibrary(page);
  assert.equal(state.library.files.length, 12);
  assert.equal(state.progress.analyzed, 12);
  await page.getByRole('button', { name: 'Toggle sound list' }).click();
  await page.getByRole('region', { name: 'Sound results' }).getByRole('button').first().click();
  await page
    .getByRole('button', { name: 'Pause preview', exact: true })
    .waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.join(reportDir, 'portable-application.png') });
  portableResult = { analyzed: 12, previewStarted: true };
  await page.close();
} finally {
  await browser.close();
}
assert.equal(await wrapperDone, 0);
const report = {
  testedAt: new Date().toISOString(),
  version: pkg.version,
  installationOutsideCheckout: true,
  cleanPath: cleanEnv.PATH,
  installExitCode: installCode,
  startMenuAndDesktopShortcuts: true,
  installed: installedResult,
  relaunchCacheHits: 12,
  uninstallExitCode: uninstallCode,
  registryAndShortcutsRemoved: true,
  separateProfileRetained: true,
  portable: portableResult,
  cleanWindowsVmTested: false,
};
await writeFile(path.join(reportDir, 'installer-results.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
