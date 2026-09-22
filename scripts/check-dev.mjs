import { createServer } from 'vite';
import { _electron as electron } from 'playwright';
import path from 'node:path';
const server = await createServer();
await server.listen();
const env = {
  ...process.env,
  SC_DEV_URL: server.resolvedUrls.local[0].replace(/\/$/, ''),
  SC_TEST_USER_DATA: path.resolve('test-results/dev-profile'),
};
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env, timeout: 30000 });
try {
  const page = await app.firstWindow({ timeout: 30000 });
  page.on('console', (message) => {
    if (message.type() === 'error') console.error(message.text());
  });
  await page.getByRole('button', { name: 'Choose Sample Folder' }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: path.resolve('test-results/06-development.png') });
  console.log('Vite development renderer launches successfully in Electron.');
} finally {
  await app.close();
  await server.close();
}
