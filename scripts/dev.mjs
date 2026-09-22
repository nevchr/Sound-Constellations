import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import electron from 'electron';
process.argv.push('--main-only');
await import('./build.mjs');
const server = await createServer();
await server.listen();
const env = { ...process.env, SC_DEV_URL: server.resolvedUrls.local[0].replace(/\/$/, '') };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ['.'], { stdio: 'inherit', env });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
