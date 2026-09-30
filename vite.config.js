import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: { host: '0.0.0.0', allowedHosts: true },
  build: {
    // pdfmake yadrosi (~1 MB) bo'linmaydi, lekin u faqat PDF yuklab olinganda
    // (dynamic import) yuklanadi — asosiy sahifaga ta'sir qilmaydi.
    chunkSizeWarningLimit: 1100,
  },
})
