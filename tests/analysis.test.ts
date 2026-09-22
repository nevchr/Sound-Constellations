import { describe, it, expect } from 'vitest';
import { extractFeatures } from '../src/main/analysis/features';
import { sampleWindows } from '../src/main/analysis/analyze';
import { normalize, nearest } from '../src/shared/math';
import { validateSettings } from '../src/main/settings';
import { DEFAULT_SETTINGS } from '../src/shared/types';
describe('real DSP', () => {
  const tone = (hz: number) =>
    Float32Array.from({ length: 22050 }, (_, i) => 0.5 * Math.sin((2 * Math.PI * hz * i) / 22050));
  it('measures RMS, peak and spectral centroid in Hz', () => {
    const { features, waveform } = extractFeatures([tone(440)], 1);
    expect(features.rms).toBeCloseTo(Math.sqrt(0.125), 3);
    expect(features.peak).toBeCloseTo(0.5, 3);
    expect(features.centroid).toBeGreaterThan(400);
    expect(features.centroid).toBeLessThan(500);
    expect(features.mfcc).toHaveLength(13);
    expect(waveform).toHaveLength(160);
  });
  it('finds neighbouring tones from audio rather than filenames', () => {
    const frequencies = [100, 105, 110, 2000, 2100, 2200, 7000, 7100];
    const vectors = normalize(
      frequencies.map((hz) => extractFeatures([tone(hz)], 1).features.vector),
    );
    expect(
      nearest(vectors, 0, 2)
        .map((n) => n.index)
        .sort(),
    ).toEqual([1, 2]);
  });
  it('handles silence and a sub-frame sound without non-finite features', () => {
    for (const pcm of [new Float32Array(22050), new Float32Array([0.1, -0.1])]) {
      expect(
        extractFeatures([pcm], pcm.length / 22050).features.vector.every(Number.isFinite),
      ).toBe(true);
    }
  });
  it('samples all five portions within a fixed total budget', () => {
    expect(sampleWindows(0.2, 12)).toEqual([{ offset: 0, seconds: 0.2 }]);
    const windows = sampleWindows(600, 12);
    expect(windows).toHaveLength(5);
    expect(windows.reduce((sum, w) => sum + w.seconds, 0)).toBe(12);
    expect(windows.at(-1)!.offset + windows.at(-1)!.seconds).toBe(600);
  });
  it('validates the narrow settings contract', () => {
    expect(validateSettings(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, volume: 9 })).toThrow();
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, neighbours: NaN })).toThrow();
    expect(() => validateSettings({ ...DEFAULT_SETTINGS, autoplay: 'true' })).toThrow();
  });
});
