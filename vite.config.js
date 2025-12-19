import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Expense Tracker', // แก้ชื่อเต็ม
        short_name: 'P Expense',           // แก้ชื่อย่อใต้ไอคอน
        description: 'แอปบันทึกรายจ่ายส่วนตัว',
        theme_color: '#F5F5F7',          // <--- แก้จุดนี้ครับ! (จากเดิม #0f172a)
        background_color: '#F5F5F7',     // <--- แก้จุดนี้ด้วยครับ (จากเดิม #ffffff)
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
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
  base: '/',
})