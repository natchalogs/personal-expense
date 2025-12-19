import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // อัปเดตแอปอัตโนมัติเมื่อมีการแก้โค้ด
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Personal Expense', // ชื่อเต็มของแอป
        short_name: 'P Expense',      // ชื่อที่โชว์ใต้ไอค่อนบนหน้าจอมือถือ
        description: 'แอปบันทึกรายจ่ายส่วนตัว',
        theme_color: '#0f172a',      // สีแถบสถานะ (แนะนำให้ตรงกับธีมแอป)
        background_color: '#ffffff',
        display: 'standalone',       // ทำให้ไม่มีแถบ URL เหมือนแอปจริง
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
            purpose: 'any maskable' // ช่วยให้ไอค่อนปรับรูปทรงตามมือถือแต่ละรุ่นได้
          }
        ]
      }
    })
  ],
  base: '/',
})