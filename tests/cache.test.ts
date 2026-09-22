import { describe, expect, it } from 'vitest';
import { AnalysisCache, cacheMatches } from '../src/main/cache/database';
import { ANALYSIS_VERSION, type AudioFile } from '../src/shared/types';
describe('SQLite cache', () => {
  const file = {
    id: 'one',
    path: 'C:\\Samples\\a.wav',
    size: 100,
    modifiedAt: 123,
    analysisVersion: ANALYSIS_VERSION,
    budget: 12,
  } as AudioFile;
  it('invalidates size, modification time, algorithm and sampling-budget changes', () => {
    expect(cacheMatches(file, file, 12)).toBe(true);
    expect(cacheMatches(file, { ...file, size: 101 }, 12)).toBe(false);
    expect(cacheMatches(file, { ...file, modifiedAt: 124 }, 12)).toBe(false);
    expect(cacheMatches({ ...file, analysisVersion: 0 }, file, 12)).toBe(false);
    expect(cacheMatches(file, file, 20)).toBe(false);
  });
  it('saves completed records independently and prunes deleted records atomically', () => {
    const cache = new AnalysisCache(':memory:');
    cache.put(file);
    cache.put({ ...file, id: 'two' });
    expect(cache.get('one')).toEqual(file);
    cache.prune(new Set(['two']));
    expect(cache.get('one')).toBeUndefined();
    expect(cache.get('two')?.id).toBe('two');
    cache.close();
  });
});
