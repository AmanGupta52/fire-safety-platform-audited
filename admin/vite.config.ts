import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // A production build without VITE_API_URL would ship an app that has no idea where its server is. Fail the build
  // with a clear message instead of finding out in the browser. (Reads .env files and real environment variables.)
  if (command === 'build' && mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    if (!env.VITE_API_URL) {
      throw new Error(
        '\n\n[admin] Build stopped: VITE_API_URL is not set.\n' +
        '  Set it to your API address (for example https://your-api.onrender.com/api) in the build environment\n' +
        '  or in admin/.env.production, then build again. See .env.example.\n'
      );
    }
  }

  return {
    plugins: [react()],
    server: {
      port: 5174
    },
    resolve: {
      alias: {
        '@': '/src'
      }
    },
    build: {
      rollupOptions: {
        output: {
          // Split third-party code into long-lived chunks so an app update doesn't make visitors re-download React,
          // and so heavy libraries load only with the pages that need them.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@remix-run)\//.test(id)) return 'react-vendor';
            if (id.includes('@tanstack')) return 'query';
            // Charts (recharts + its d3 helpers) are only needed by the dashboard and reports pages.
            if (id.includes('recharts') || /node_modules\/(d3-[^/]+|victory-vendor|recharts-scale|react-smooth|internmap)\//.test(id)) return 'charts';
            if (id.includes('@sentry')) return 'sentry';
            return undefined;
          }
        }
      }
    }
  };
});
