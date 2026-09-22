import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, EMPTY_LIBRARY, EMPTY_PROGRESS, type Settings } from '../../shared/types';
export function useLibrary() {
  const [library, setLibrary] = useState(EMPTY_LIBRARY);
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [error, setError] = useState('');
  const [cachePath, setCachePath] = useState('');
  useEffect(() => {
    if (!window.sound) {
      setError('Open this application in Electron to access your local audio library.');
      return;
    }
    const offProgress = window.sound.onProgress((value) => {
      setProgress(value);
      if (value.phase === 'error')
        setError(value.message ?? 'Analysis failed. Please try rescanning.');
    });
    const offLibrary = window.sound.onLibrary(setLibrary);
    window.sound
      .snapshot()
      .then((snapshot) => {
        setLibrary(snapshot.library);
        setProgress(snapshot.progress);
        setSettings(snapshot.settings);
        setCachePath(snapshot.cachePath);
      })
      .catch((e) => setError(String(e)));
    return () => {
      offProgress();
      offLibrary();
    };
  }, []);
  const updateSettings = (value: Settings) => {
    setSettings(value);
    void window.sound.settings(value).catch((e) => setError(String(e)));
  };
  const action = (fn: () => Promise<unknown>) => {
    setError('');
    void fn().catch((e) => setError(String(e)));
  };
  const busy = ['scanning', 'analyzing', 'projecting'].includes(progress.phase);
  return { library, progress, settings, updateSettings, error, setError, cachePath, action, busy };
}
