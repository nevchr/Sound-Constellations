import { contextBridge, ipcRenderer } from 'electron';
import type { SoundApi, ScanProgress, Library } from '../shared/types';
const api: SoundApi = {
  snapshot: () => ipcRenderer.invoke('app:snapshot'),
  chooseFolders: () => ipcRenderer.invoke('library:choose'),
  rescan: () => ipcRenderer.invoke('library:rescan'),
  cancel: () => ipcRenderer.invoke('library:cancel'),
  settings: (value) => ipcRenderer.invoke('settings:save', value),
  reveal: (id) => ipcRenderer.invoke('file:reveal', id),
  preview: (id) => ipcRenderer.invoke('audio:preview', id),
  onProgress: (callback) => {
    const handler = (_event: unknown, value: ScanProgress) => callback(value);
    ipcRenderer.on('scan:progress', handler);
    return () => ipcRenderer.removeListener('scan:progress', handler);
  },
  onLibrary: (callback) => {
    const handler = (_event: unknown, value: Library) => callback(value);
    ipcRenderer.on('library:changed', handler);
    return () => ipcRenderer.removeListener('library:changed', handler);
  },
};
contextBridge.exposeInMainWorld('sound', api);
