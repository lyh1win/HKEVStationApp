import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  server: {
    // Proxy CLP EV charger API to avoid CORS issues during dev
    proxy: {
      '/api/evcharger': {
        target: 'https://api.clp.com.hk',
        changeOrigin: true,
        pathRewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
