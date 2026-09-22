import { Crosshair, FolderOpen, Play, X } from 'lucide-react';
import type { AudioFile, Library } from '../../shared/types';
import { duration, size } from '../utils/format';
import Waveform from './Waveform';
interface Props {
  file: AudioFile;
  library: Library;
  selected: number;
  neighbours: { index: number; distance: number }[];
  onSelect: (index: number, focus?: boolean) => void;
  onFocus: () => void;
  onPlay: () => void;
  onReveal: () => void;
  onClose: () => void;
  debug: boolean;
}
export default function Inspector({
  file,
  library,
  selected,
  neighbours,
  onSelect,
  onFocus,
  onPlay,
  onReveal,
  onClose,
  debug,
}: Props) {
  // Standardized dimensions transformed to a bounded visual indicator, relative to this library.
  const z = library.vectors[selected] ?? [];
  const relative = (value: number) => Math.max(0, Math.min(100, 50 + value * 20));
  return (
    <aside className="inspector">
      <div className="section-heading">
        <span>SELECTED SOUND</span>
        <button className="icon-button" aria-label="Close inspector" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <div className="file-type">
        <span className="signal-dot" />
        {file.extension.toUpperCase()} <span> / LOCAL AUDIO</span>
      </div>
      <h2 title={file.name}>{file.name}</h2>
      <p className="file-folder" title={file.path}>
        {file.folder || file.root}
      </p>
      <div className="inspector-wave">
        <Waveform buckets={file.waveform} sampled={file.sampled} />
      </div>
      <span className="microcopy">
        {file.sampled ? 'SAMPLED AMPLITUDE · 5 WINDOWS' : 'AMPLITUDE ENVELOPE'}
      </span>
      <div className="inspector-actions">
        <button className="primary" onClick={onPlay}>
          <Play size={14} />
          Preview
        </button>
        <button className="secondary" onClick={onFocus}>
          <Crosshair size={14} />
          Focus
        </button>
      </div>
      <dl className="metadata">
        <div>
          <dt>Duration</dt>
          <dd>{duration(file.duration)}</dd>
        </div>
        <div>
          <dt>File size</dt>
          <dd>{size(file.size)}</dd>
        </div>
        {file.sampleRate && (
          <div>
            <dt>Sample rate</dt>
            <dd>{(file.sampleRate / 1000).toFixed(1)} kHz</dd>
          </div>
        )}
        {file.channels && (
          <div>
            <dt>Channels</dt>
            <dd>{file.channels === 1 ? 'Mono' : file.channels === 2 ? 'Stereo' : file.channels}</dd>
          </div>
        )}
        {file.bitDepth && (
          <div>
            <dt>Bit depth</dt>
            <dd>{file.bitDepth}-bit</dd>
          </div>
        )}
        <div>
          <dt>Modified</dt>
          <dd>
            {new Date(file.modifiedAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </dd>
        </div>
      </dl>
      <section className="characteristics">
        <h3>ACOUSTIC CHARACTER</h3>
        {[
          ['Brightness', z[3] ?? 0, 'Spectral centroid'],
          ['Energy', z[1] ?? 0, 'RMS level'],
          ['Noisiness', z[6] ?? 0, 'Spectral flatness'],
        ].map(([label, value, explanation]) => (
          <div
            className="character"
            key={String(label)}
            title={`${explanation}; relative to the current library`}
          >
            <span>{label}</span>
            <div className="meter">
              <i style={{ width: `${relative(Number(value))}%` }} />
            </div>
          </div>
        ))}
        <p>Relative to your library · based on measured audio features.</p>
      </section>
      <section className="neighbour-list">
        <div className="section-heading">
          <h3>NEAREST SOUNDS</h3>
          <span>{neighbours.length.toString().padStart(2, '0')}</span>
        </div>
        {neighbours.length === 0 && (
          <p className="muted">Add more sounds to discover neighbours.</p>
        )}
        {neighbours.map((n, i) => (
          <button
            key={library.files[n.index].id}
            onClick={() => onSelect(n.index, true)}
            title={library.files[n.index].path}
          >
            <span className="list-number">{(i + 1).toString().padStart(2, '0')}</span>
            <span className="neighbour-name">
              {library.files[n.index].name}
              <small>{duration(library.files[n.index].duration)}</small>
            </span>
            <span className="score" title="Similarity score, not certainty">
              {Math.round(100 / (1 + n.distance))}
              <small>score</small>
            </span>
          </button>
        ))}
      </section>
      <button className="text-button reveal" onClick={onReveal}>
        <FolderOpen size={14} />
        Show in Explorer
      </button>
      {debug && (
        <details className="debug" open>
          <summary>Development feature inspector</summary>
          <pre>{JSON.stringify(file.features, null, 2)}</pre>
        </details>
      )}
    </aside>
  );
}
