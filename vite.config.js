import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, '/');
          if (!moduleId.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) return 'vendor-react';
          if (/\/node_modules\/(react-router|react-router-dom)\//.test(moduleId)) return 'vendor-router';
          if (moduleId.includes('/node_modules/@tanstack/')) return 'vendor-query';
          if (moduleId.includes('/node_modules/@radix-ui/')) return 'vendor-ui';
          if (moduleId.includes('/node_modules/framer-motion/')) return 'vendor-motion';
          if (moduleId.includes('/node_modules/lucide-react/')) return 'vendor-icons';
          if (moduleId.includes('/node_modules/recharts/')) return 'vendor-charts';
          if (moduleId.includes('/node_modules/react-leaflet/') || moduleId.includes('/node_modules/leaflet/')) return 'vendor-maps';
          return undefined;
        },
      },
    },
  },
});
