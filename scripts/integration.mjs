import { Worker } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile, copyFile, utimes, unlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import ffmpeg from 'ffmpeg-static';
import { generateLibrary } from './generate-library.mjs';
const directory = path.resolve('test-results', `integration-${Date.now()}`);
await mkdir(directory, { recursive: true });
const fixture = await generateLibrary(path.join(directory, 'samples'));
const settings = {
  volume: 0.7,
  autoplay: true,
  loop: false,
  pointSize: 1,
  glow: 0.7,
  lines: true,
  neighbours: 5,
  maxAnalysisSeconds: 12,
  hidden: false,
  quality: 'medium',
};
const cachePath = path.join(directory, 'analysis.sqlite');
async function transcode(input, output) {
  await new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, ['-nostdin', '-v', 'error', '-i', input, output], {
      windowsHide: true,
    });
    let stderr = '';
    process.stderr.on('data', (data) => (stderr += data));
    process.on('error', reject);
    process.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
  });
}
const input = path.join(fixture, 'Misc', 'Tones', 'Tone_001.wav');
for (const ext of ['mp3', 'flac', 'ogg', 'm4a'])
  await transcode(input, path.join(fixture, `format-test.${ext}`));
await writeFile(path.join(fixture, 'broken.wav'), 'This is deliberately not audio');
await writeFile(path.join(fixture, 'unsupported.aiff'), 'Unsupported extension fixture');
await writeFile(path.join(fixture, 'readme.txt'), 'Non-audio file');
async function hashes(root) {
  const map = {};
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) Object.assign(map, await hashes(filename));
    else
      map[filename] = createHash('sha256')
        .update(await readFile(filename))
        .digest('hex');
  }
  return map;
}
function scan(roots, cancelAfter = Infinity, cache = cachePath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve('dist/main/worker.cjs'), {
      workerData: { roots, settings, cachePath: cache },
    });
    let progress;
    let library;
    let cancelled = false;
    worker.on('message', (message) => {
      if (message.type === 'library') library = message.library;
      if (message.type === 'progress') {
        progress = message.progress;
        if (!cancelled && progress.analyzed >= cancelAfter) {
          cancelled = true;
          worker.postMessage('cancel');
        }
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code || !library) reject(new Error(`Scan failed: ${JSON.stringify(progress)}`));
      else resolve({ library, progress });
    });
  });
}
const before = await hashes(fixture);
const started = performance.now();
const first = await scan([fixture, path.join(fixture, 'Drums')]);
assert.equal(first.progress.analyzed, 52);
assert.equal(first.progress.failed, 1);
assert.equal(first.progress.unsupported, 1);
assert.equal(first.library.files.length, 52);
assert.deepEqual(await hashes(fixture), before, 'Analysis must not alter a source file');
assert.deepEqual([...new Set(first.library.files.map((file) => file.extension))].sort(), [
  'flac',
  'm4a',
  'mp3',
  'ogg',
  'wav',
]);
const second = await scan([fixture]);
assert.equal(second.progress.cached, 52);
assert.equal(second.progress.analyzed, 0);
assert.deepEqual(second.library.points, first.library.points);
// All mutations below affect only the test fixtures created by this script.
const deleted = path.join(fixture, 'Drums', 'Hats', 'Hat_001.wav');
assert.ok(deleted.startsWith(directory + path.sep));
await unlink(deleted);
await copyFile(input, path.join(fixture, 'new-tone.wav'));
await utimes(input, new Date(), new Date(Date.now() + 2000));
const incremental = await scan([fixture]);
assert.equal(incremental.progress.analyzed, 2);
assert.equal(incremental.progress.cached, 50);
assert.equal(incremental.library.files.length, 52);
assert.equal(
  incremental.library.files.some((f) => f.path === deleted),
  false,
);
const cancelled = await scan([fixture], 3, path.join(directory, 'cancel.sqlite'));
assert.equal(cancelled.progress.phase, 'cancelled');
assert.ok(cancelled.progress.analyzed >= 3);
assert.ok(cancelled.library.files.length < 52);
const resumed = await scan([fixture], Infinity, path.join(directory, 'cancel.sqlite'));
assert.equal(resumed.progress.cached, cancelled.progress.analyzed);
assert.equal(resumed.library.files.length, 52);
// Similarity sanity: every generated kick's closest neighbour should be another kick.
const kicks = first.library.files.flatMap((f, i) => (f.name.startsWith('Kick_') ? [i] : []));
for (const index of kicks) {
  const v = first.library.vectors[index];
  const distances = first.library.vectors
    .map((other, i) => ({ i, distance: other.reduce((sum, x, j) => sum + (x - v[j]) ** 2, 0) }))
    .filter((n) => n.i !== index)
    .sort((a, b) => a.distance - b.distance);
  assert.ok(first.library.files[distances[0].i].name.startsWith('Kick_'));
}
const result = {
  testedAt: new Date().toISOString(),
  seconds: (performance.now() - started) / 1000,
  formats: ['WAV PCM16', 'MP3', 'FLAC', 'OGG Vorbis', 'M4A AAC'],
  analyzed: first.progress.analyzed,
  cacheHits: second.progress.cached,
  incremental: { analyzed: incremental.progress.analyzed, cached: incremental.progress.cached },
  completedBeforeCancel: cancelled.progress.analyzed,
  sourceHashesUnchanged: true,
  generatedKickNeighbours: '8 of 8 closest neighbours are kicks',
  checks: [
    'real codec decoding',
    'recursive scan',
    'overlapping roots',
    'corrupt audio',
    'unsupported extension',
    'unchanged source SHA256 hashes',
    'cache reopen',
    'deterministic layout',
    'added/changed/deleted files',
    'cancellation',
    'resume cache reuse',
  ],
};
await writeFile(
  path.resolve('test-results/integration-results.json'),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
