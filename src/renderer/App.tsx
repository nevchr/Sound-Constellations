import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Crosshair, FolderPlus, List, Maximize, Search, X } from 'lucide-react';
import { nearest } from '../shared/math';
import { useLibrary } from './hooks/useLibrary';
import { usePreview } from './audio/usePreview';
import Constellation from './constellation/Constellation';
import Sidebar, { type Filters } from './components/Sidebar';
import Inspector from './components/Inspector';
import Progress from './components/Progress';
import SettingsPanel from './components/SettingsPanel';
import MiniPlayer from './components/MiniPlayer';
import Topbar from './components/Topbar';
import { duration } from './utils/format';
export default function App() {
  const { library, progress, settings, updateSettings, error, setError, cachePath, action, busy } =
    useLibrary();
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>({ folder: '', extension: '', duration: '' });
  const [showSettings, setShowSettings] = useState(false);
  const [showList, setShowList] = useState(false);
  const [debug, setDebug] = useState(false);
  const [focus, setFocus] = useState(0);
  const [reset, setReset] = useState(0);
  const [flat, setFlat] = useState(false);
  const player = usePreview(settings, setError);
  const selected = library.files.findIndex((file) => file.id === selectedId);
  const file = library.files[selected];
  const neighbours = useMemo(
    () => nearest(library.vectors, selected, settings.neighbours),
    [library.vectors, selected, settings.neighbours],
  );
  const neighbourIndices = useMemo(() => neighbours.map((n) => n.index), [neighbours]);
  const searchIndex = useMemo(
    () => library.files.map((file) => `${file.name} ${file.path} ${file.extension}`.toLowerCase()),
    [library],
  );
  const visible = useMemo(
    () =>
      new Set(
        library.files.flatMap((f, i) => {
          const folder = f.root + (f.folder ? '\\' + f.folder.replaceAll('/', '\\') : '');
          const matchesFolder =
            !filters.folder ||
            folder === filters.folder ||
            folder.startsWith(filters.folder + '\\');
          const matchesDuration =
            !filters.duration ||
            (filters.duration === 'short' && f.duration < 1) ||
            (filters.duration === 'medium' && f.duration >= 1 && f.duration < 5) ||
            (filters.duration === 'long' && f.duration >= 5 && f.duration < 30) ||
            (filters.duration === 'track' && f.duration >= 30);
          return matchesFolder &&
            matchesDuration &&
            (!filters.extension || f.extension === filters.extension) &&
            (!query || searchIndex[i].includes(query.toLowerCase().trim()))
            ? [i]
            : [];
        }),
      ),
    [library, filters, query, searchIndex],
  );
  function select(index: number, focusStar = false) {
    const next = library.files[index];
    if (!next) return;
    setSelectedId(next.id);
    if (focusStar) setFocus((n) => n + 1);
    if (settings.autoplay) void player.play(next);
    else player.stop();
  }
  useEffect(() => {
    if (selectedId && selected < 0) {
      setSelectedId('');
      player.stop();
    }
  }, [library]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === '/' && !target.matches('input,textarea,select') && !showSettings) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('.search-box input')?.focus();
        return;
      }
      if (
        target.matches('input,textarea,select,button') ||
        target.isContentEditable ||
        showSettings
      )
        return;
      if (event.code === 'Space') {
        event.preventDefault();
        player.toggle(file);
      }
      if (import.meta.env.DEV && event.ctrlKey && event.shiftKey && event.code === 'KeyD')
        setDebug((value) => !value);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [file, player.toggle, showSettings]);
  const closeSettings = useCallback(() => setShowSettings(false), []);
  const choose = () => action(() => window.sound.chooseFolders());
  const listed = [...visible].slice(0, 100);
  return (
    <div className="app-shell">
      <Topbar
        query={query}
        setQuery={setQuery}
        onSubmit={() => {
          if (listed.length) {
            select(listed[0], true);
            setQuery('');
          }
        }}
        onSettings={() => setShowSettings(true)}
      />
      <div className="workspace">
        <Sidebar
          library={library}
          progress={progress}
          filters={filters}
          onFilter={setFilters}
          onAdd={choose}
          onRescan={() => action(() => window.sound.rescan())}
          busy={busy}
        />
        <main className="space-panel">
          <Constellation
            library={library}
            visible={visible}
            selected={selected}
            neighbours={neighbourIndices}
            settings={settings}
            focus={focus}
            reset={reset}
            flat={flat}
            onSelect={select}
          />
          <div className="map-header">
            <div>
              <span className="eyebrow">ACOUSTIC ATLAS / 001</span>
              <h1>
                {library.files.length ? 'Your sound, in space.' : 'A universe waiting to be heard.'}
              </h1>
              {library.files.length > 0 && (
                <p>
                  <span className="signal-dot" />
                  {visible.size.toLocaleString()} visible{' '}
                  <span className="muted">/ {library.files.length.toLocaleString()} sounds</span>
                </p>
              )}
            </div>
            <div className="map-tools">
              <div className="dimension-switch">
                <button className={!flat ? 'active' : ''} onClick={() => setFlat(false)}>
                  3D
                </button>
                <button className={flat ? 'active' : ''} onClick={() => setFlat(true)}>
                  2D
                </button>
              </div>
              <button
                className="map-tool"
                title="Reset view"
                aria-label="Reset view"
                onClick={() => setReset((n) => n + 1)}
              >
                <Maximize size={16} />
              </button>
              <button
                className={`map-tool ${showList ? 'active' : ''}`}
                title="Keyboard-accessible sound list"
                aria-label="Toggle sound list"
                onClick={() => setShowList((value) => !value)}
              >
                <List size={17} />
              </button>
            </div>
          </div>
          {!library.files.length && !busy && (
            <div className="landing">
              <div className="orbital-mark">
                <div />
                <div />
                <div />
                <span>✧</span>
              </div>
              <span className="eyebrow">A NEW WAY TO FIND YOUR NEXT SOUND</span>
              <h2>
                Listen beyond
                <br />
                the folder.
              </h2>
              <p>
                Turn your sample library into an explorable constellation.
                <br />
                Similar sounds find their place together.
              </p>
              <button className="primary choose-button" onClick={choose}>
                <FolderPlus size={17} />
                Choose Sample Folder
                <ArrowUpRight size={17} />
              </button>
              <span className="landing-formats">WAV · MP3 · FLAC · OGG · M4A</span>
              <p className="landing-privacy">Analyzed on your computer. Nothing uploaded.</p>
            </div>
          )}
          {library.files.length > 0 && visible.size === 0 && (
            <div className="no-results">
              <Search size={24} />
              <h2>No sounds in this view</h2>
              <p>Try another search or clear your filters.</p>
              <button
                className="secondary"
                onClick={() => {
                  setFilters({ folder: '', extension: '', duration: '' });
                  setQuery('');
                }}
              >
                Show all sounds
              </button>
            </div>
          )}
          {(query || showList) && library.files.length > 0 && (
            <section className="sound-results" aria-label="Sound results">
              <div className="section-heading">
                <span>{query ? 'SEARCH RESULTS' : 'SOUNDS IN VIEW'}</span>
                <span>{visible.size.toLocaleString()}</span>
              </div>
              {listed.map((i) => (
                <button
                  className={i === selected ? 'selected' : ''}
                  key={library.files[i].id}
                  onClick={() => {
                    select(i, true);
                    if (query) setQuery('');
                  }}
                >
                  <span className="signal-dot" />
                  <span>
                    {library.files[i].name}
                    <small>{library.files[i].folder || 'Library root'}</small>
                  </span>
                  <small>{duration(library.files[i].duration)}</small>
                </button>
              ))}
              {visible.size > 100 && (
                <p className="muted">Showing the first 100. Search to narrow this list.</p>
              )}
            </section>
          )}
          {file && (
            <button className="selected-label" onClick={() => setFocus((n) => n + 1)}>
              <Crosshair size={13} />
              <span>{file.name}</span>
            </button>
          )}
          {busy && (
            <Progress progress={progress} onCancel={() => action(() => window.sound.cancel())} />
          )}
          <div className="map-footer">
            <div className="controls-hint">
              <span>
                <kbd>DRAG</kbd>
                {flat ? 'Pan' : 'Orbit'}
              </span>
              <span>
                <kbd>RIGHT DRAG</kbd>Pan
              </span>
              <span>
                <kbd>SCROLL</kbd>Zoom
              </span>
              <span>
                <kbd>SPACE</kbd>Play / pause
              </span>
            </div>
            <div className="map-legend">
              <i />
              Size: duration
              <span />
              Color: brightness
            </div>
          </div>
        </main>
        {file && (
          <Inspector
            file={file}
            library={library}
            selected={selected}
            neighbours={neighbours}
            onSelect={select}
            onFocus={() => setFocus((n) => n + 1)}
            onPlay={() => void player.play(file)}
            onReveal={() => action(() => window.sound.reveal(file.id))}
            onClose={() => {
              player.stop();
              setSelectedId('');
            }}
            debug={debug}
          />
        )}
      </div>
      <MiniPlayer file={file} player={player} settings={settings} updateSettings={updateSettings} />
      {error && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={17} />
          </button>
        </div>
      )}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={updateSettings}
          onClose={closeSettings}
          cachePath={cachePath}
        />
      )}
    </div>
  );
}
