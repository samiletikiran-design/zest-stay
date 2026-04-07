import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(), 
      tailwindcss(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
          filename: 'manifest.json',
          devOptions: {
            enabled: true,
            type: 'module',
          },
          manifest: {
            name: 'Zest Stay',
            short_name: 'Zest Stay',
            description: 'Smart PG & Hostel Management System',
            theme_color: '#4f46e5',
            background_color: '#ffffff',
            display: 'standalone',
            orientation: 'portrait',
            start_url: '/',
            scope: '/',
            icons: [
              {
                src: 'https://firebasestorage.googleapis.com/v0/b/zest-stay.firebasestorage.app/o/Zest%20Stay%20Logo.png?alt=media&token=a9d14fd2-5361-4864-9752-16f667f99f19',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'https://firebasestorage.googleapis.com/v0/b/zest-stay.firebasestorage.app/o/Zest%20Stay%20Logo.png?alt=media&token=a9d14fd2-5361-4864-9752-16f667f99f19',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'https://firebasestorage.googleapis.com/v0/b/zest-stay.firebasestorage.app/o/Zest%20Stay%20Logo.png?alt=media&token=a9d14fd2-5361-4864-9752-16f667f99f19',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
              }
            ]
          }
        })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
