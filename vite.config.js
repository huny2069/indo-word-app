import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: '인도네시아어 맞춤형 학습장',
        short_name: 'IndoLearn',
        description: '오프라인 지원 인도네시아어 단어장 및 학습 앱',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  server: {
    host: true, // 외부 IP 접속 허용
    port: 5443, 
    https: false, // 터널링 서비스(Cloudflare 등)와 충돌 방지를 위해 일단 꺼둡니다.
    allowedHosts: true 
  }
});
