import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 👇 แก้บรรทัดนี้ครับ ให้เหลือแค่ slash ตัวเดียว
  base: '/', 
})