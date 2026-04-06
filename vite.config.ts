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
                src: 'https://api.dicebear.com/7.x/initials/png?seed=ZS&backgroundColor=4f46e5&width=192&height=192',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'https://api.dicebear.com/7.x/initials/png?seed=ZS&backgroundColor=4f46e5&width=512&height=512',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: 'https://api.dicebear.com/7.x/initials/png?seed=ZS&backgroundColor=4f46e5&width=192&height=192',
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
