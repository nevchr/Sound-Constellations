import { parentPort, workerData } from 'node:worker_threads';
import { stat } from 'node:fs/promises';
import { AnalysisCache, cacheMatches } from './cache/database';
import { scanFolders } from './filesystem/scanner';
import { analyze } from './analysis/analyze';
import { normalize, PcaReducer } from '../shared/math';
import { EMPTY_PROGRESS, type AudioFile, type Settings } from '../shared/types';
const data = workerData as { roots: string[]; settings: Settings; cachePath: string };
const abort = new AbortController();
parentPort?.on('message', (message) => {
  if (message === 'cancel') abort.abort();
});
async function run() {
  const progress = {
    ...EMPTY_PROGRESS,
    issues: [] as string[],
    phase: 'scanning' as typeof EMPTY_PROGRESS.phase,
  };
  const cache = new AnalysisCache(data.cachePath);
  const files: AudioFile[] = [];
  let last = 0;
  const update = (force = false) => {
    if (force || Date.now() - last > 100) {
      parentPort?.postMessage({ type: 'progress', progress });
      last = Date.now();
    }
  };
  try {
    update(true);
    const candidates = await scanFolders(
      data.roots,
      data.settings.hidden,
      progress,
      () => abort.signal.aborted,
      update,
    );
    const discoveryFailures = progress.failed;
    progress.phase = 'analyzing';
    update(true);
    for (const file of candidates) {
      if (abort.signal.aborted) break;
      progress.current = file.name;
      try {
        const cached = cache.get(file.id);
        if (cached && cacheMatches(cached, file, data.settings.maxAnalysisSeconds)) {
          files.push({ ...cached, root: file.root, folder: file.folder });
          progress.cached++;
        } else {
          const result = await analyze(file, data.settings.maxAnalysisSeconds, abort.signal);
          const current = await stat(file.path);
          if (current.size !== file.size || current.mtimeMs !== file.modifiedAt)
            throw new Error('File changed during analysis; rescan to retry');
          cache.put(result);
          files.push(result);
          progress.analyzed++;
        }
      } catch (error) {
        if (abort.signal.aborted) break;
        progress.failed++;
        if (progress.issues.length < 100)
          progress.issues.push(`${file.name}: ${String(error).slice(0, 500)}`);
      }
      progress.processed++;
      update();
    }
    // A cancelled or inaccessible scan must never prune records it did not get to inspect.
    if (!abort.signal.aborted && discoveryFailures === 0)
      cache.prune(new Set(candidates.map((f) => f.id)));
    const wasCancelled = abort.signal.aborted;
    progress.phase = 'projecting';
    progress.current = '';
    update(true);
    const vectors = normalize(files.map((f) => f.features.vector));
    const points = new PcaReducer().reduce(vectors);
    parentPort?.postMessage({
      type: 'library',
      library: { files, vectors, points, roots: data.roots },
    });
    progress.phase = wasCancelled ? 'cancelled' : 'complete';
    update(true);
  } catch (error) {
    progress.phase = 'error';
    progress.message = String(error);
    update(true);
  } finally {
    cache.close();
    parentPort?.close();
  }
}
void run();
