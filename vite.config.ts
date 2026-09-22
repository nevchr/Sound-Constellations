import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const nonce = 'sound-constellations-local-development';
export default defineConfig(({ command }) => ({
  root: 'src/renderer',
  base: './',
  plugins: [
    react(),
    {
      name: 'local-development-csp',
      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          return context.server
            ? html
                .replace("script-src 'self';", `script-src 'self' 'nonce-${nonce}';`)
                .replace('ws://127.0.0.1:5173', 'ws://127.0.0.1:*')
            : html;
        },
      },
    },
  ],
  html: { cspNonce: command === 'serve' ? nonce : undefined },
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
  server: { host: '127.0.0.1', port: 5187, strictPort: false },
}));
