import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '../..',
  // FPS uses original procedural geometry/audio; unreviewed source assets are not shipped.
  publicDir: false,
  server: { strictPort: true },
});
