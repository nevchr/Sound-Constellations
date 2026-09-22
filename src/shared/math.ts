import type { Point3D } from './types';
export function normalize(vectors: number[][]): number[][] {
  if (!vectors.length) return [];
  const dimensions = vectors[0].length;
  if (vectors.some((v) => v.length !== dimensions || v.some((n) => !Number.isFinite(n))))
    throw new Error('Invalid feature vector');
  const means = Array(dimensions).fill(0) as number[];
  vectors.forEach((v) => v.forEach((x, j) => (means[j] += x / vectors.length)));
  const deviations = means.map((mean, j) =>
    Math.sqrt(vectors.reduce((sum, v) => sum + (v[j] - mean) ** 2, 0) / vectors.length),
  );
  return vectors.map((v) =>
    v.map((x, j) => (deviations[j] < 1e-10 ? 0 : (x - means[j]) / deviations[j])),
  );
}
export function distance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, x, i) => sum + (x - b[i]) ** 2, 0) / Math.max(1, a.length));
}
export function nearest(vectors: number[][], index: number, count = 5) {
  if (!vectors[index]) return [];
  return vectors
    .map((v, i) => ({ index: i, distance: distance(vectors[index], v) }))
    .filter((n) => n.index !== index)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, count);
}
export interface DimensionReducer {
  reduce(vectors: number[][]): Point3D[];
}
// Covariance power iteration with fixed seeds, canonical signs and deflation. O(n*d²), never O(n²).
export class PcaReducer implements DimensionReducer {
  reduce(vectors: number[][]): Point3D[] {
    if (!vectors.length) return [];
    const d = vectors[0].length;
    const covariance = Array.from({ length: d }, () => Array(d).fill(0) as number[]);
    for (const row of vectors)
      for (let i = 0; i < d; i++)
        for (let j = i; j < d; j++) covariance[i][j] += (row[i] * row[j]) / vectors.length;
    for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) covariance[i][j] = covariance[j][i];
    const axes: number[][] = [];
    for (let axis = 0; axis < 3; axis++) {
      let v = Array.from({ length: d }, (_, i) => Math.sin((i + 1) * (axis + 1) + 0.7));
      for (let iteration = 0; iteration < 100; iteration++) {
        const next = covariance.map((row) => row.reduce((sum, x, j) => sum + x * v[j], 0));
        const norm = Math.hypot(...next);
        v = norm < 1e-10 ? next.map(() => 0) : next.map((x) => x / norm);
      }
      const pivot = v.reduce((best, x, i) => (Math.abs(x) > Math.abs(v[best]) ? i : best), 0);
      if (v[pivot] < 0) v = v.map((x) => -x);
      const lambda = v.reduce(
        (sum, x, i) => sum + x * covariance[i].reduce((s, c, j) => s + c * v[j], 0),
        0,
      );
      axes.push(v);
      for (let i = 0; i < d; i++)
        for (let j = 0; j < d; j++) covariance[i][j] -= lambda * v[i] * v[j];
    }
    const projected = vectors.map((row) =>
      axes.map((axis) => axis.reduce((sum, x, i) => sum + x * row[i], 0)),
    );
    let extent = 1;
    for (const p of projected) extent = Math.max(extent, Math.hypot(...p));
    return projected.map((p) => ({
      x: (p[0] / extent) * 65,
      y: (p[1] / extent) * 65,
      z: (p[2] / extent) * 65,
    }));
  }
}
