/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // เพิ่มตรงนี้: บอกว่าถ้าใช้ font-sans ให้เอา Prompt ขึ้นก่อน
      fontFamily: {
        sans: ['Prompt', 'sans-serif'],
      },
    },
  },
  plugins: [],
}