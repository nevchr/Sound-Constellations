import { Search, Settings2, X } from 'lucide-react';
interface Props {
  query: string;
  setQuery: (value: string) => void;
  onSubmit: () => void;
  onSettings: () => void;
}
export default function Topbar({ query, setQuery, onSubmit, onSettings }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-symbol">✧</span>
        <div>
          SOUND<span>CONSTELLATIONS</span>
        </div>
        <span className="version">V.01</span>
      </div>
      <div className="search-box">
        <Search size={16} />
        <input
          aria-label="Search sounds"
          placeholder="Find a sound in your universe…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
            if (e.key === 'Escape') setQuery('');
          }}
        />
        <kbd>/</kbd>
        {query && (
          <button className="icon-button" aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={14} />
          </button>
        )}
      </div>
      <div className="top-actions">
        <span className="offline-badge">
          <i />
          OFFLINE BY DESIGN
        </span>
        <button className="icon-button" aria-label="Settings" onClick={onSettings}>
          <Settings2 size={19} />
        </button>
      </div>
    </header>
  );
}
