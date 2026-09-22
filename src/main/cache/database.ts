import { DatabaseSync } from 'node:sqlite';
import { ANALYSIS_VERSION, type AudioFile } from '../../shared/types';
import type { Candidate } from '../filesystem/scanner';
export function cacheMatches(file: AudioFile, candidate: Pick<Candidate, 'path' | 'size' | 'modifiedAt'>, budget: number): boolean {
  return file.path === candidate.path && file.size === candidate.size && file.modifiedAt === candidate.modifiedAt && file.analysisVersion === ANALYSIS_VERSION && file.budget === budget;
}
export class AnalysisCache {
  private db: DatabaseSync;
  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS audio (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
  }
  get(id: string): AudioFile | undefined {
    const row = this.db.prepare('SELECT data FROM audio WHERE id=?').get(id);
    if (!row) return undefined;
    try { return JSON.parse(String(row.data)) as AudioFile; } catch { return undefined; }
  }
  put(file: AudioFile) { this.db.prepare('INSERT OR REPLACE INTO audio(id,data) VALUES(?,?)').run(file.id, JSON.stringify(file)); }
  prune(ids: Set<string>) {
    const rows = this.db.prepare('SELECT id FROM audio').all();
    const remove = this.db.prepare('DELETE FROM audio WHERE id=?');
    this.db.exec('BEGIN');
    try { for (const row of rows) if (!ids.has(String(row.id))) remove.run(row.id); this.db.exec('COMMIT'); }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}
