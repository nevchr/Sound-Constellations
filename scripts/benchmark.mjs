import { Worker } from 'node:worker_threads';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { generateLibrary } from './generate-library.mjs';
const count = Number(process.argv[2] ?? 5000);
const output = path.resolve('test-results', `benchmark-${count}`);
await mkdir(output, { recursive: true });
const roots = [await generateLibrary(path.join(output, 'samples'), count)];
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
const cachePath = path.join(output, 'analysis.sqlite');
await writeFile(path.join(output, 'preferences.json'), JSON.stringify({ roots, settings }));
async function run() {
  const started = performance.now();
  let progress;
  let library;
  let memory = 0;
  let last = 0;
  await new Promise((resolve, reject) => {
    const worker = new Worker(path.resolve('dist/main/worker.cjs'), {
      workerData: { roots, settings, cachePath },
    });
    const timer = setInterval(() => {
      memory = Math.max(memory, process.memoryUsage().rss);
    }, 100);
    worker.on('message', (message) => {
      if (message.type === 'library') library = message.library;
      if (message.type === 'progress') {
        progress = message.progress;
        if (progress.processed - last >= 500) {
          last = progress.processed;
          console.log(`${progress.processed}/${count} (${progress.cached} cached)`);
        }
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => {
      clearInterval(timer);
      code ? reject(new Error(`Worker exited ${code}`)) : resolve();
    });
  });
  assert.equal(library.files.length, count);
  assert.equal(progress.failed, 0);
  return {
    seconds: (performance.now() - started) / 1000,
    analyzed: progress.analyzed,
    cached: progress.cached,
    peakProcessRssMiB: Math.round(memory / 1048576),
    points: library.points.length,
  };
}
const cold = await run();
console.log('First scan', cold);
const warm = await run();
assert.equal(warm.cached, count);
assert.equal(warm.analyzed, 0);
const results = {
  testedAt: new Date().toISOString(),
  count,
  cold,
  warm,
  note: 'Peak RSS covers the Node parent plus worker, not the separate short-lived decoder processes.',
};
await writeFile(
  path.resolve('test-results/benchmark-results.json'),
  JSON.stringify(results, null, 2),
);
console.log(JSON.stringify(results, null, 2));
