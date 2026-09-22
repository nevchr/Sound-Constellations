import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SETTINGS, type Settings } from '../shared/types';
export function validateSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') throw new Error('Invalid settings');
  const s = value as Record<string, unknown>;
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, min, max] of [
    ['volume', 0, 1],
    ['pointSize', 0.5, 2.5],
    ['glow', 0, 1],
    ['neighbours', 1, 10],
    ['maxAnalysisSeconds', 5, 60],
  ] as const) {
    if (typeof s[key] !== 'number' || !Number.isFinite(s[key]) || s[key] < min || s[key] > max)
      throw new Error(`Invalid ${key}`);
    result[key] = key === 'neighbours' ? Math.round(s[key]) : s[key];
  }
  for (const key of ['autoplay', 'loop', 'lines', 'hidden'] as const) {
    if (typeof s[key] !== 'boolean') throw new Error(`Invalid ${key}`);
    result[key] = s[key];
  }
  if (!['low', 'medium', 'high'].includes(String(s.quality))) throw new Error('Invalid quality');
  result.quality = s.quality as Settings['quality'];
  return result;
}
export interface Preferences {
  roots: string[];
  settings: Settings;
}
export async function loadPreferences(directory: string): Promise<Preferences> {
  await mkdir(directory, { recursive: true });
  try {
    const data = JSON.parse(
      await readFile(path.join(directory, 'preferences.json'), 'utf8'),
    ) as Preferences;
    return {
      roots: Array.isArray(data.roots)
        ? data.roots.filter((r) => typeof r === 'string' && path.isAbsolute(r))
        : [],
      settings: validateSettings({ ...DEFAULT_SETTINGS, ...data.settings }),
    };
  } catch {
    return { roots: [], settings: { ...DEFAULT_SETTINGS } };
  }
}
let pending = Promise.resolve();
export function savePreferences(directory: string, preferences: Preferences) {
  const serialized = JSON.stringify(preferences, null, 2);
  const operation = pending
    .catch(() => {})
    .then(async () => {
      const temp = path.join(directory, 'preferences.json.tmp');
      await writeFile(temp, serialized);
      await rename(temp, path.join(directory, 'preferences.json'));
    });
  pending = operation;
  return operation;
}
