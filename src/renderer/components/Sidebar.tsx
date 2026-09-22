import {
  Folder,
  FolderPlus,
  Library as LibraryIcon,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { useMemo } from 'react';
import type { Library, ScanProgress } from '../../shared/types';
import { basename, duration, size } from '../utils/format';
export interface Filters {
  folder: string;
  extension: string;
  duration: string;
}
export default function Sidebar({
  library,
  filters,
  onFilter,
  onAdd,
  onRescan,
  busy,
  progress,
}: {
  library: Library;
  filters: Filters;
  onFilter: (filters: Filters) => void;
  onAdd: () => void;
  onRescan: () => void;
  busy: boolean;
  progress: ScanProgress;
}) {
  const folders = useMemo(() => {
    const counts = new Map<string, { count: number; label: string; depth: number }>();
    for (const file of library.files) {
      const parts = file.folder.split(/[\\/]/).filter(Boolean);
      for (let i = 0; i <= parts.length; i++) {
        const key = file.root + (i ? '\\' + parts.slice(0, i).join('\\') : '');
        const old = counts.get(key);
        counts.set(key, {
          count: (old?.count ?? 0) + 1,
          label: i ? parts[i - 1] : basename(file.root),
          depth: i,
        });
      }
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b));
  }, [library]);
  const totalSize = library.files.reduce((sum, file) => sum + file.size, 0);
  const durations = library.files.map((f) => f.duration);
  return (
    <aside className="sidebar">
      <div className="library-heading">
        <span>YOUR LIBRARY</span>
        <LibraryIcon size={15} />
      </div>
      <button
        className={`folder-row all ${!filters.folder ? 'active' : ''}`}
        onClick={() => onFilter({ ...filters, folder: '' })}
      >
        <span className="tiny-orbit">✧</span>
        <span>All sounds</span>
        <span className="count">{library.files.length.toLocaleString()}</span>
      </button>
      <nav className="folder-tree" aria-label="Folder filters">
        {folders.map(([key, folder]) => (
          <button
            key={key}
            title={key}
            className={`folder-row ${filters.folder === key ? 'active' : ''}`}
            style={{ paddingLeft: 14 + Math.min(folder.depth, 5) * 12 }}
            onClick={() => onFilter({ ...filters, folder: filters.folder === key ? '' : key })}
          >
            <Folder size={13} />
            <span>{folder.label}</span>
            <span className="count">{folder.count}</span>
          </button>
        ))}
      </nav>
      <button className="add-folder text-button" onClick={onAdd} disabled={busy}>
        <FolderPlus size={15} />
        Add folder
      </button>
      <div className="sidebar-divider" />
      <div className="library-heading">
        <span>NARROW THE FIELD</span>
        <SlidersHorizontal size={14} />
      </div>
      <label className="filter-label">
        File format
        <select
          aria-label="File format"
          value={filters.extension}
          onChange={(e) => onFilter({ ...filters, extension: e.target.value })}
        >
          <option value="">All formats</option>
          {['wav', 'mp3', 'flac', 'ogg', 'm4a'].map((ext) => (
            <option key={ext} value={ext}>
              {ext.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label className="filter-label">
        Duration
        <select
          aria-label="Duration filter"
          value={filters.duration}
          onChange={(e) => onFilter({ ...filters, duration: e.target.value })}
        >
          <option value="">Any duration</option>
          <option value="short">Less than 1 second</option>
          <option value="medium">1–5 seconds</option>
          <option value="long">5–30 seconds</option>
          <option value="track">30 seconds or longer</option>
        </select>
      </label>
      {(filters.folder || filters.extension || filters.duration) && (
        <button
          className="text-button clear-filters"
          onClick={() => onFilter({ folder: '', extension: '', duration: '' })}
        >
          Clear filters
        </button>
      )}
      <div className="library-stats">
        <div className="sidebar-divider" />
        <h3>IN THIS SPACE</h3>
        <p>
          <strong>{library.files.length.toLocaleString()}</strong> sounds <span>·</span>{' '}
          {size(totalSize)}
        </p>
        <p>{folders.length} folders</p>
        {durations.length > 0 && (
          <p>
            {duration(durations.reduce((min, n) => Math.min(min, n), Infinity))} —{' '}
            {duration(durations.reduce((max, n) => Math.max(max, n), 0))}
          </p>
        )}
        <button
          className="rescan text-button"
          onClick={onRescan}
          disabled={busy || !library.roots.length}
        >
          <RefreshCw size={13} className={busy ? 'spin' : ''} />
          Rescan library
        </button>
        {progress.phase !== 'idle' && !busy && (
          <details className="scan-report">
            <summary>Last scan · {progress.phase}</summary>
            <dl>
              {(
                ['discovered', 'analyzed', 'cached', 'skipped', 'unsupported', 'failed'] as const
              ).map((key) => (
                <div key={key}>
                  <dt>{key}</dt>
                  <dd>{progress[key]}</dd>
                </div>
              ))}
            </dl>
            {progress.issues.length > 0 && (
              <div className="scan-issues">
                {progress.issues.map((issue, i) => (
                  <p key={i}>{issue}</p>
                ))}
              </div>
            )}
          </details>
        )}
      </div>
      <div className="local-indicator">
        <i />
        LOCAL & PRIVATE
      </div>
    </aside>
  );
}
