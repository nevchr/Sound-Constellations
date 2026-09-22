import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile, symlink, readdir, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { scanFolders } from '../src/main/filesystem/scanner';
import { EMPTY_PROGRESS } from '../src/shared/types';
describe('read-only recursive scanner', () => {
  let directory: string;
  beforeAll(async () => {
    await mkdir('test-results', { recursive: true });
    directory = await mkdtemp(path.resolve('test-results/scanner-'));
    await mkdir(path.join(directory, 'nested'));
    await mkdir(path.join(directory, '.hidden'));
    await writeFile(path.join(directory, 'nested/a.WAV'), 'scan fixture');
    await writeFile(path.join(directory, '.hidden/b.wav'), 'scan fixture');
    await writeFile(path.join(directory, 'unsupported.aif'), 'scan fixture');
    await writeFile(path.join(directory, 'notes.txt'), 'text');
    await symlink(path.join(directory, 'nested'), path.join(directory, 'junction'), 'junction');
  });
  it('deduplicates overlapping roots, skips junctions and dot folders, reports unsupported formats', async () => {
    const progress = { ...EMPTY_PROGRESS, issues: [] as string[] };
    const files = await scanFolders(
      [directory, path.join(directory, 'nested')],
      false,
      progress,
      () => false,
      () => {},
    );
    expect(files).toHaveLength(1);
    expect(files[0].extension).toBe('wav');
    expect(progress.unsupported).toBe(1);
    expect(progress.skipped).toBeGreaterThanOrEqual(3);
  });
  it('includes dot folders when enabled and reports an inaccessible root safely', async () => {
    const progress = { ...EMPTY_PROGRESS, issues: [] as string[] };
    const files = await scanFolders(
      [directory, path.join(directory, 'does-not-exist')],
      true,
      progress,
      () => false,
      () => {},
    );
    expect(files).toHaveLength(2);
    expect(progress.failed).toBe(1);
    expect(progress.issues.some((issue) => issue.includes('Folder unavailable'))).toBe(true);
  });
  it('honours cancellation during discovery', async () => {
    const progress = { ...EMPTY_PROGRESS, issues: [] as string[] };
    expect(
      await scanFolders(
        [directory],
        true,
        progress,
        () => true,
        () => {},
      ),
    ).toEqual([]);
  });
  afterAll(async () => {
    // Only remove the junction itself. Never recursively delete through it.
    if (directory) {
      await rmdir(path.join(directory, 'junction'));
    }
  });
});
