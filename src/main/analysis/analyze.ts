import { parseFile } from 'music-metadata';
import { ANALYSIS_VERSION, type AudioFile } from '../../shared/types';
import type { Candidate } from '../filesystem/scanner';
import { decodePcm } from './decode';
import { extractFeatures } from './features';
export function sampleWindows(
  duration: number,
  budget: number,
): { offset: number; seconds: number }[] {
  if (duration <= budget) return [{ offset: 0, seconds: duration }];
  const seconds = budget / 5;
  return Array.from({ length: 5 }, (_, i) => ({ offset: ((duration - seconds) * i) / 4, seconds }));
}
export async function analyze(
  file: Candidate,
  budget: number,
  signal: AbortSignal,
): Promise<AudioFile> {
  const metadata = await parseFile(file.path, { duration: true, skipCovers: true });
  const f = metadata.format;
  const duration = f.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0)
    throw new Error('Audio duration could not be read');
  const sections: Float32Array[] = [];
  for (const window of sampleWindows(duration, budget))
    sections.push(await decodePcm(file.path, window.offset, window.seconds, 22050, 1, signal));
  return {
    ...file,
    duration,
    sampleRate: f.sampleRate,
    channels: f.numberOfChannels,
    bitDepth: f.bitsPerSample,
    ...extractFeatures(sections, duration),
    sampled: duration > budget,
    analysisVersion: ANALYSIS_VERSION,
    budget,
  };
}
