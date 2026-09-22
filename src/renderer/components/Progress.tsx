import type { ScanProgress } from '../../shared/types';
export default function Progress({
  progress,
  onCancel,
}: {
  progress: ScanProgress;
  onCancel: () => void;
}) {
  const total = Math.max(0, progress.discovered - progress.unsupported);
  return (
    <div className="scan-progress" role="status" aria-live="polite">
      <div className="progress-title">
        <span>
          {progress.phase === 'scanning'
            ? 'Discovering your sounds'
            : progress.phase === 'projecting'
              ? 'Mapping acoustic space'
              : 'Listening to your library'}
        </span>
        <button className="text-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <progress
        max={Math.max(1, total)}
        value={
          progress.phase === 'scanning' || progress.phase === 'projecting'
            ? undefined
            : progress.processed
        }
      />
      <div className="progress-detail">
        <span>
          {progress.processed.toLocaleString()} / {total.toLocaleString()} files ·{' '}
          {progress.cached.toLocaleString()} cached · {progress.analyzed.toLocaleString()} analyzed
        </span>
        <span>{progress.phase}</span>
      </div>
      <p title={progress.current}>{progress.current || 'Preparing your constellation…'}</p>
    </div>
  );
}
