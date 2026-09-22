import { app, BrowserWindow, dialog, ipcMain, protocol, session, shell } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { Worker } from 'node:worker_threads';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { EMPTY_LIBRARY, EMPTY_PROGRESS, type Library, type ScanProgress } from '../shared/types';
import { loadPreferences, savePreferences, validateSettings, type Preferences } from './settings';
import { decodePcm } from './analysis/decode';
import { pathKey } from './filesystem/scanner';
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);
const profileDirectory = app.commandLine.getSwitchValue('user-data-dir');
if (profileDirectory && path.isAbsolute(profileDirectory))
  app.setPath('userData', profileDirectory);
if (!app.isPackaged && process.env.SC_TEST_USER_DATA)
  app.setPath('userData', process.env.SC_TEST_USER_DATA);
let window: BrowserWindow | null = null;
let worker: Worker | undefined;
let library: Library = { ...EMPTY_LIBRARY };
let progress: ScanProgress = { ...EMPTY_PROGRESS };
let preferences: Preferences;
let directory: string;
let cachePath: string;
let previewAbort: AbortController | undefined;
const devUrl =
  !app.isPackaged && /^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(process.env.SC_DEV_URL ?? '')
    ? process.env.SC_DEV_URL
    : undefined;
function send(channel: string, payload: unknown) {
  if (window && !window.isDestroyed()) window.webContents.send(channel, payload);
}
function validateSender(event: IpcMainInvokeEvent) {
  const url = event.senderFrame?.url;
  if (
    !window ||
    event.sender !== window.webContents ||
    event.senderFrame !== window.webContents.mainFrame ||
    !(url?.startsWith('app://ui/') || (devUrl && new URL(url ?? '').origin === devUrl))
  )
    throw new Error('Untrusted IPC sender');
}
function register(channel: string, callback: (...args: unknown[]) => unknown) {
  ipcMain.handle(channel, (event, ...args: unknown[]) => {
    validateSender(event);
    return callback(...args);
  });
}
async function authorizedFile(id: unknown) {
  if (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id)) throw new Error('Invalid sound ID');
  const file = library.files.find((f) => f.id === id);
  if (!file) throw new Error('Sound is not in the active library');
  const actual = await realpath(file.path);
  if (pathKey(actual) !== pathKey(file.path)) throw new Error('File path changed; please rescan');
  const info = await stat(actual);
  if (!info.isFile() || info.size !== file.size || info.mtimeMs !== file.modifiedAt)
    throw new Error('File changed or is unavailable; please rescan');
  return file;
}
function startScan() {
  if (worker || !preferences.roots.length) return;
  progress = { ...EMPTY_PROGRESS, issues: [], phase: 'scanning' };
  send('scan:progress', progress);
  worker = new Worker(path.join(__dirname, 'worker.cjs'), {
    workerData: { roots: preferences.roots, settings: preferences.settings, cachePath },
  });
  worker.on('message', (message: { type: string; library?: Library; progress?: ScanProgress }) => {
    if (message.type === 'library' && message.library) {
      library = message.library;
      send('library:changed', library);
    }
    if (message.type === 'progress' && message.progress) {
      progress = message.progress;
      send('scan:progress', progress);
    }
  });
  worker.on('error', (error) => {
    progress = { ...progress, phase: 'error', message: error.message };
    send('scan:progress', progress);
  });
  worker.on('exit', (code) => {
    worker = undefined;
    if (code && progress.phase !== 'error') {
      progress = {
        ...progress,
        phase: 'error',
        message: 'Analysis worker stopped unexpectedly. Completed analyses remain cached.',
      };
      send('scan:progress', progress);
    }
  });
}
async function boot() {
  directory = app.getPath('userData');
  cachePath = path.join(directory, 'analysis.sqlite');
  preferences = await loadPreferences(directory);
  if (!app.isPackaged && process.env.SC_TEST_LIBRARY)
    preferences.roots = [await realpath(process.env.SC_TEST_LIBRARY)];
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'ui' || request.method !== 'GET')
      return new Response('Forbidden', { status: 403 });
    const base = path.join(__dirname, '../renderer');
    const target = path.resolve(
      base,
      '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname),
    );
    if (!target.startsWith(base + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
      };
      return new Response(await readFile(target), {
        headers: { 'Content-Type': mime[path.extname(target)] ?? 'application/octet-stream' },
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false),
  );
  session.defaultSession.setPermissionCheckHandler(() => false);
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const allowed =
      details.url.startsWith('app://ui/') ||
      details.url.startsWith('devtools://') ||
      Boolean(
        devUrl &&
        (details.url.startsWith(devUrl + '/') ||
          details.url.startsWith(devUrl.replace('http:', 'ws:') + '/')),
      );
    callback({ cancel: !allowed });
  });
  register('app:snapshot', () => ({
    library,
    progress,
    settings: preferences.settings,
    cachePath,
  }));
  register('library:choose', async () => {
    if (worker || !window) return;
    const selected = await dialog.showOpenDialog(window, {
      title: 'Choose sample folders',
      properties: ['openDirectory', 'multiSelections'],
      buttonLabel: 'Explore sounds',
    });
    if (selected.canceled) return;
    const roots = await Promise.all(selected.filePaths.map((p) => realpath(p)));
    const keys = new Set(preferences.roots.map(pathKey));
    preferences.roots.push(
      ...roots.filter((root) => {
        const key = pathKey(root);
        if (keys.has(key)) return false;
        keys.add(key);
        return true;
      }),
    );
    await savePreferences(directory, preferences);
    startScan();
  });
  register('library:rescan', () => startScan());
  register('library:cancel', () => {
    worker?.postMessage('cancel');
  });
  register('settings:save', async (value) => {
    preferences.settings = validateSettings(value);
    await savePreferences(directory, preferences);
    return preferences.settings;
  });
  register('file:reveal', async (id) => {
    const file = await authorizedFile(id);
    shell.showItemInFolder(file.path);
  });
  register('audio:preview', async (id) => {
    const file = await authorizedFile(id);
    previewAbort?.abort();
    previewAbort = new AbortController();
    const pcm = await decodePcm(
      file.path,
      0,
      Math.min(file.duration, 30),
      44100,
      2,
      previewAbort.signal,
    );
    return {
      pcm: new Uint8Array(pcm.buffer),
      sampleRate: 44100,
      channels: 2,
      truncated: file.duration > 30,
    };
  });
  window = new BrowserWindow({
    width: 1480,
    height: 960,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#080d14',
    icon: path.join(__dirname, '../../assets/icon.png'),
    title: 'Sound Constellations',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  await window.loadURL(devUrl ?? 'app://ui/index.html');
  if (preferences.roots.length) startScan();
}
app
  .whenReady()
  .then(boot)
  .catch((error) => {
    dialog.showErrorBox('Sound Constellations could not start', String(error));
    app.quit();
  });
app.on('window-all-closed', () => {
  previewAbort?.abort();
  worker?.postMessage('cancel');
  app.quit();
});
