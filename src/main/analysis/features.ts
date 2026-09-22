import Meyda, { type MeydaFeaturesObject } from 'meyda';
import type { Features } from '../../shared/types';
const RATE = 22050;
const FRAME = 1024;
const HOP = 512;
Meyda.sampleRate = RATE;
Meyda.bufferSize = FRAME;
Meyda.numberOfMFCCCoefficients = 13;
const finite = (n: number) => (Number.isFinite(n) ? n : 0);
export function extractFeatures(
  sections: Float32Array[],
  duration: number,
): { features: Features; waveform: number[] } {
  const rows: number[][] = [];
  let peak = 0;
  let squares = 0;
  let samples = 0;
  const waveform: number[] = [];
  for (const pcm of sections) {
    for (const sample of pcm) {
      const x = finite(sample);
      peak = Math.max(peak, Math.abs(x));
      squares += x * x;
      samples++;
    }
    const bucketCount = Math.max(1, Math.floor(160 / sections.length));
    for (let bucket = 0; bucket < bucketCount; bucket++) {
      const start = Math.floor((bucket * pcm.length) / bucketCount);
      const end = Math.floor(((bucket + 1) * pcm.length) / bucketCount);
      let amplitude = 0;
      for (let i = start; i < end; i++) amplitude = Math.max(amplitude, Math.abs(finite(pcm[i])));
      waveform.push(amplitude);
    }
    for (let start = 0; start < pcm.length; start += HOP) {
      const frame = new Float32Array(FRAME);
      frame.set(pcm.subarray(start, Math.min(start + FRAME, pcm.length)));
      const extracted = Meyda.extract(
        [
          'rms',
          'spectralCentroid',
          'spectralSpread',
          'spectralRolloff',
          'spectralFlatness',
          'zcr',
          'mfcc',
        ],
        frame,
      );
      if (!extracted) continue;
      const f = extracted as MeydaFeaturesObject;
      rows.push(
        [
          f.rms!,
          (f.spectralCentroid! * RATE) / FRAME,
          (f.spectralSpread! * RATE) / FRAME,
          f.spectralRolloff!,
          f.spectralFlatness!,
          f.zcr! / FRAME,
          ...f.mfcc!,
        ].map(finite),
      );
      if (start + FRAME >= pcm.length) break;
    }
  }
  if (!samples || !rows.length) throw new Error('The file contains no decodable audio samples');
  const means = rows[0].map((_, j) => rows.reduce((sum, row) => sum + row[j], 0) / rows.length);
  const std = means.map((mean, j) =>
    Math.sqrt(rows.reduce((sum, row) => sum + (row[j] - mean) ** 2, 0) / rows.length),
  );
  const rms = Math.sqrt(squares / samples);
  // Log-compress duration and energy; standardization later gives all dimensions comparable scales.
  const vector = [
    Math.log1p(duration),
    Math.log1p(rms * 100),
    peak,
    ...means.slice(1, 6),
    ...means.slice(7),
    ...std.slice(0, 6),
  ]; // MFCC 0 duplicates absolute energy, so omit it.
  return {
    features: {
      rms,
      peak,
      centroid: means[1],
      spread: means[2],
      rolloff: means[3],
      flatness: means[4],
      zcr: means[5],
      mfcc: means.slice(6),
      vector: vector.map(finite),
    },
    waveform,
  };
}
