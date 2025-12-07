import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,

    rollupOptions: {
      input: {
        service1: path.resolve(__dirname, "src/App.jsx"),
        service2: path.resolve(__dirname, "src/Service2.jsx"),
        service3: path.resolve(__dirname, "src/Service3.jsx"),
        qr:        path.resolve(__dirname, "src/QRscan.jsx"),
      },
      output: {
        entryFileNames: "assets/[name].bundle.js",
        chunkFileNames: "assets/[name].chunk.js",
        assetFileNames: "assets/[name].[ext]",
      }
    }
  }
})
