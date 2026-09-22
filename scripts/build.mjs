import { build } from 'esbuild';
import { build as viteBuild } from 'vite';
export async function buildMain() {
  await build({
    entryPoints: {
      main: 'src/main/main.ts',
      worker: 'src/main/worker.ts',
      preload: 'src/preload/preload.ts',
    },
    outdir: 'dist/main',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron', 'ffmpeg-static'],
    sourcemap: true,
  });
}
await buildMain();
if (!process.argv.includes('--main-only')) await viteBuild();
