export const ANALYSIS_VERSION = 1;
export const EXTENSIONS = ['wav', 'mp3', 'flac', 'ogg', 'm4a'] as const;
export interface Features {
  rms: number;
  peak: number;
  centroid: number;
  spread: number;
  rolloff: number;
  flatness: number;
  zcr: number;
  mfcc: number[];
  vector: number[];
}
export interface AudioFile {
  id: string;
  name: string;
  path: string;
  folder: string;
  root: string;
  extension: string;
  size: number;
  modifiedAt: number;
  duration: number;
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  features: Features;
  waveform: number[];
  sampled: boolean;
  analysisVersion: number;
  budget: number;
}
export interface Point3D {
  x: number;
  y: number;
  z: number;
}
export interface Library {
  files: AudioFile[];
  points: Point3D[];
  vectors: number[][];
  roots: string[];
}
export interface ScanProgress {
  phase: 'idle' | 'scanning' | 'analyzing' | 'projecting' | 'complete' | 'cancelled' | 'error';
  discovered: number;
  processed: number;
  analyzed: number;
  cached: number;
  skipped: number;
  unsupported: number;
  failed: number;
  current: string;
  issues: string[];
  message?: string;
}
export interface Settings {
  volume: number;
  autoplay: boolean;
  loop: boolean;
  pointSize: number;
  glow: number;
  lines: boolean;
  neighbours: number;
  maxAnalysisSeconds: number;
  hidden: boolean;
  quality: 'low' | 'medium' | 'high';
}
export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7,
  autoplay: true,
  loop: false,
  pointSize: 1,
  glow: 0.7,
  lines: true,
  neighbours: 5,
  maxAnalysisSeconds: 12,
  hidden: false,
  quality: 'medium',
};
export const EMPTY_LIBRARY: Library = { files: [], points: [], vectors: [], roots: [] };
export const EMPTY_PROGRESS: ScanProgress = {
  phase: 'idle',
  discovered: 0,
  processed: 0,
  analyzed: 0,
  cached: 0,
  skipped: 0,
  unsupported: 0,
  failed: 0,
  current: '',
  issues: [],
};
export interface AppSnapshot {
  library: Library;
  settings: Settings;
  progress: ScanProgress;
  cachePath: string;
}
export interface SoundApi {
  snapshot(): Promise<AppSnapshot>;
  chooseFolders(): Promise<void>;
  rescan(): Promise<void>;
  cancel(): Promise<void>;
  settings(value: Settings): Promise<Settings>;
  reveal(id: string): Promise<void>;
  preview(
    id: string,
  ): Promise<{ pcm: Uint8Array; sampleRate: number; channels: number; truncated: boolean }>;
  onProgress(callback: (progress: ScanProgress) => void): () => void;
  onLibrary(callback: (library: Library) => void): () => void;
}
declare global {
  interface Window {
    sound: SoundApi;
  }
}
