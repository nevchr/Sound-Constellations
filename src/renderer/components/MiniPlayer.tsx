import { Headphones, Pause, Play, Repeat2, Sparkles, Square, Volume2 } from 'lucide-react';
import type { AudioFile, Settings } from '../../shared/types';
import type { usePreview } from '../audio/usePreview';
import { duration } from '../utils/format';
import Waveform from './Waveform';
interface Props {
  file: AudioFile | undefined;
  player: ReturnType<typeof usePreview>;
  settings: Settings;
  updateSettings: (value: Settings) => void;
}
export default function MiniPlayer({ file, player, settings, updateSettings }: Props) {
  return (
    <footer className="mini-player">
      <div className="player-transport">
        <button
          className="play-button"
          aria-label={player.playing ? 'Pause preview' : 'Play preview'}
          disabled={!file || player.loading}
          onClick={() => player.toggle(file)}
        >
          {player.loading ? (
            <span className="loading-dot" />
          ) : player.playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <button
          className="icon-button"
          aria-label="Stop preview"
          disabled={!file}
          onClick={player.stop}
        >
          <Square size={14} />
        </button>
      </div>
      <div className="now-playing">
        <span className="eyebrow">
          {player.loading ? 'LOADING PREVIEW' : player.playing ? 'NOW PLAYING' : 'READY TO LISTEN'}
        </span>
        <strong>{file?.name || 'Select a star. Discover a sound.'}</strong>
        {file && (
          <small>
            {file.extension.toUpperCase()} · {duration(file.duration)}
            {file.duration > 30 ? ' · First 30 s preview' : ''}
          </small>
        )}
      </div>
      <div className="player-wave">
        {file ? (
          <>
            <Waveform
              buckets={file.waveform}
              sampled={file.sampled}
              progress={file.sampled ? 0 : player.position / Math.max(0.001, file.duration)}
            />
            <div>
              <span>{duration(player.position)}</span>
              <span>{file.sampled ? 'SAMPLED ENVELOPE' : 'WAVEFORM'}</span>
              <span>
                {duration(
                  player.previewDuration && player.playing
                    ? player.previewDuration
                    : Math.min(file.duration, 30),
                )}
              </span>
            </div>
          </>
        ) : (
          <div className="player-idle">
            <Headphones size={17} />
            <span>Your next discovery is out there.</span>
          </div>
        )}
      </div>
      <button
        className={`icon-button ${settings.loop ? 'active' : ''}`}
        aria-label="Loop previews"
        aria-pressed={settings.loop}
        onClick={() => updateSettings({ ...settings, loop: !settings.loop })}
      >
        <Repeat2 size={19} />
      </button>
      <label className="volume-control">
        <Volume2 size={17} />
        <input
          aria-label="Preview volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.volume}
          onChange={(e) => updateSettings({ ...settings, volume: Number(e.target.value) })}
        />
      </label>
      <span className="local-audio">
        <Sparkles size={14} />
        LOCAL AUDIO
      </span>
    </footer>
  );
}
