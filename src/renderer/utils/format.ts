export function duration(seconds: number) {
  return seconds < 10
    ? `${seconds.toFixed(2)} s`
    : seconds < 60
      ? `${seconds.toFixed(1)} s`
      : `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60)
          .toString()
          .padStart(2, '0')}`;
}
export function size(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : bytes < 1024 ** 3
      ? `${(bytes / 1024 ** 2).toFixed(1)} MB`
      : `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}
export function basename(path: string) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
}
