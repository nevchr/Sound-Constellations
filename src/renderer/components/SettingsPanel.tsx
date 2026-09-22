import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { Settings } from '../../shared/types';
export default function SettingsPanel({
  settings,
  onChange,
  onClose,
  cachePath,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClose: () => void;
  cachePath: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    panel.current?.querySelector('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const nodes = panel.current?.querySelectorAll<HTMLElement>('button,input,select');
        if (!nodes?.length) return;
        if (event.shiftKey && document.activeElement === nodes[0]) {
          event.preventDefault();
          nodes[nodes.length - 1].focus();
        }
        if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {
          event.preventDefault();
          nodes[0].focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [onClose]);
  function range(
    key: 'volume' | 'pointSize' | 'glow' | 'neighbours' | 'maxAnalysisSeconds',
    label: string,
    min: number,
    max: number,
    step: number,
    suffix = '',
  ) {
    return (
      <label className="setting-row">
        <span>
          {label}
          <output>
            {Number(settings[key].toFixed(2))}
            {suffix}
          </output>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={settings[key]}
          onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
        />
      </label>
    );
  }
  function toggle(key: 'autoplay' | 'loop' | 'lines' | 'hidden', label: string) {
    return (
      <label className="toggle-row">
        <span>{label}</span>
        <input
          type="checkbox"
          checked={settings[key]}
          onChange={(e) => onChange({ ...settings, [key]: e.target.checked })}
        />
      </label>
    );
  }
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-heading">
          <h2 id="settings-title">Make space your own.</h2>
          <button className="icon-button" aria-label="Close settings" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <h3>LISTENING</h3>
        {range('volume', 'Preview volume', 0, 1, 0.05)}
        {toggle('autoplay', 'Auto-play on selection')}
        {toggle('loop', 'Loop previews')}
        <h3>CONSTELLATION</h3>
        {range('pointSize', 'Point size', 0.5, 2.5, 0.1)}
        {range('glow', 'Glow intensity', 0, 1, 0.1)}
        {toggle('lines', 'Neighbour connections')}
        {range('neighbours', 'Nearest neighbours', 1, 10, 1)}
        <label className="toggle-row">
          <span>Rendering quality</span>
          <select
            value={settings.quality}
            onChange={(e) =>
              onChange({ ...settings, quality: e.target.value as Settings['quality'] })
            }
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <h3>LOCAL ANALYSIS</h3>
        {range('maxAnalysisSeconds', 'Audio sampled per file', 5, 60, 1, ' s')}
        {toggle('hidden', 'Include dot-prefixed files and folders')}
        <p className="muted">
          Analysis changes take effect on the next rescan. Long files are sampled at five positions.
          Previews play up to the first 30 seconds.
        </p>
        <h3>CACHE LOCATION</h3>
        <p className="cache-path">{cachePath}</p>
        <p className="privacy-note">
          Your audio stays on this computer. Source files are read-only.
        </p>
      </div>
    </div>
  );
}
