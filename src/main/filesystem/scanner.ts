import { readdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { EXTENSIONS, type ScanProgress } from '../../shared/types';
export interface Candidate {
  id: string;
  name: string;
  path: string;
  root: string;
  folder: string;
  extension: string;
  size: number;
  modifiedAt: number;
}
export const pathKey = (value: string) =>
  process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
export async function scanFolders(
  roots: string[],
  hidden: boolean,
  progress: ScanProgress,
  cancelled: () => boolean,
  update: () => void,
): Promise<Candidate[]> {
  const files: Candidate[] = [];
  const seen = new Set<string>();
  const visited = new Set<string>();
  const unsupported = new Set([
    'aiff',
    'aif',
    'wma',
    'opus',
    'aac',
    'alac',
    'aifc',
    'amr',
    'ape',
    'mid',
    'midi',
  ]);
  const issue = (text: string) => {
    if (progress.issues.length < 100) progress.issues.push(text);
  };
  for (const source of roots) {
    let root: string;
    try {
      root = await realpath(source);
    } catch {
      progress.failed++;
      issue(`Folder unavailable: ${source}`);
      continue;
    }
    const pending = [root];
    while (pending.length && !cancelled()) {
      const directory = pending.pop()!;
      if (visited.has(pathKey(directory))) continue;
      visited.add(pathKey(directory));
      progress.current = directory;
      update();
      try {
        const entries = await readdir(directory, { withFileTypes: true });
        entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
        for (const entry of entries) {
          if (cancelled()) break;
          const absolute = path.join(directory, entry.name);
          if (entry.isSymbolicLink() || (!hidden && entry.name.startsWith('.'))) {
            progress.skipped++;
            continue;
          }
          if (entry.isDirectory()) {
            pending.push(absolute);
            continue;
          }
          if (!entry.isFile()) {
            progress.skipped++;
            continue;
          }
          const extension = path.extname(entry.name).slice(1).toLowerCase();
          if (!EXTENSIONS.includes(extension as (typeof EXTENSIONS)[number])) {
            if (unsupported.has(extension)) {
              progress.discovered++;
              progress.unsupported++;
              issue(`Unsupported format: ${absolute}`);
            } else progress.skipped++;
            continue;
          }
          const key = pathKey(absolute);
          if (seen.has(key)) {
            progress.skipped++;
            continue;
          }
          seen.add(key);
          progress.discovered++;
          try {
            const stat = await lstat(absolute);
            if (!stat.isFile() || stat.isSymbolicLink()) {
              progress.skipped++;
              continue;
            }
            files.push({
              id: createHash('sha256').update(key).digest('hex').slice(0, 32),
              name: entry.name,
              path: absolute,
              root,
              folder: path.relative(root, directory),
              extension,
              size: stat.size,
              modifiedAt: stat.mtimeMs,
            });
          } catch {
            progress.failed++;
            issue(`Could not read: ${absolute}`);
          }
        }
      } catch {
        progress.failed++;
        issue(`Could not access folder: ${directory}`);
      }
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
