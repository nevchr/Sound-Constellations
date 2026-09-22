import { describe, expect, it } from 'vitest';
import { normalize, distance, nearest, PcaReducer } from '../src/shared/math';
describe('standardization and similarity', () => {
  it('standardizes known vectors and safely zeros constant dimensions', () => {
    const result = normalize([
      [1, 7],
      [2, 7],
      [3, 7],
    ]);
    expect(result[0][0]).toBeCloseTo(-Math.sqrt(1.5));
    expect(result[1]).toEqual([0, 0]);
    expect(result[2][0]).toBeCloseTo(Math.sqrt(1.5));
    expect(normalize([[5, 5]])).toEqual([[0, 0]]);
    expect(normalize([])).toEqual([]);
  });
  it('rejects incompatible or non-finite vectors', () => {
    expect(() => normalize([[NaN]])).toThrow();
    expect(() => normalize([[1], [2, 3]])).toThrow();
  });
  it('assigns zero distance to identical vectors and finds expected neighbours', () => {
    const vectors = [
      [0, 0],
      [0, 0],
      [0.2, 0.1],
      [8, 9],
      [-5, -4],
    ];
    expect(distance(vectors[0], vectors[1])).toBe(0);
    expect(distance(vectors[0], vectors[3])).toBeGreaterThan(1);
    expect(nearest(vectors, 0, 2).map((n) => n.index)).toEqual([1, 2]);
    expect(nearest([], 0)).toEqual([]);
  });
  it('projects deterministically, including rank-deficient and singleton datasets', () => {
    const reducer = new PcaReducer();
    const vectors = normalize([
      [1, 2, 1],
      [2, 4, 2],
      [3, 6, 1],
      [4, 8, 2],
    ]);
    expect(reducer.reduce(vectors)).toEqual(reducer.reduce(vectors));
    expect(reducer.reduce([[0, 0]])).toEqual([{ x: 0, y: 0, z: 0 }]);
    expect(reducer.reduce(vectors).every((p) => Object.values(p).every(Number.isFinite))).toBe(
      true,
    );
  });
  it('processes 5,000 feature vectors without pairwise matrix allocation', () => {
    const vectors = normalize(
      Array.from({ length: 5000 }, (_, i) =>
        Array.from(
          { length: 26 },
          (_, j) => Math.sin(i * 0.07 + j) + Math.cos(i * (j + 1) * 0.003),
        ),
      ),
    );
    const start = performance.now();
    const points = new PcaReducer().reduce(vectors);
    expect(points).toHaveLength(5000);
    expect(nearest(vectors, 123, 10)).toHaveLength(10);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});
