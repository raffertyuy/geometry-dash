import { defineConfig } from 'vite';

export default defineConfig({
  // Empty plugins array required by Cloudflare's wrangler-based deploy
  // flow — `wrangler deploy` injects its own plugin into this slot when
  // building. Without the array it bails with "could not find a valid
  // plugins array". Safe no-op for local `vite build` / `vite dev`.
  plugins: [],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
