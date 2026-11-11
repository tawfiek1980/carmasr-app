import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

function inlineCssToHtml(): Plugin {
  return {
    name: 'inline-css-to-html',
    apply: 'build',
    closeBundle() {
      const dir = path.resolve(process.cwd(), 'dist')
      const htmlFile = path.join(dir, 'index.html')
      if (!fs.existsSync(htmlFile)) return
      let content = fs.readFileSync(htmlFile, 'utf8')
      const refs = [...content.matchAll(/<link rel="stylesheet"[^>]*href="(\/assets\/[^"]+\.css)"[^>]*>/g)]
      for (const m of refs) {
        const cssPath = path.join(dir, m[1].replace(/^\//, ''))
        if (!fs.existsSync(cssPath)) continue
        const css = fs.readFileSync(cssPath, 'utf8')
        content = content.replace(m[0], `<style>${css}</style>`)
        fs.rmSync(cssPath)
      }
      fs.writeFileSync(htmlFile, content)
    },
  }
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    inlineCssToHtml(),
  ],
  base: '/',
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase') || id.includes('node_modules/@grpc') || id.includes('node_modules/idb') || id.includes('node_modules/protobufjs') || id.includes('node_modules/long') || id.includes('node_modules/faye-websocket') || id.includes('node_modules/websocket-extensions')) {
            return 'vendor-firebase';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-animation';
          }
          if (id.includes('node_modules')) {
            return 'vendor-other';
          }
        },
      },
    },
  },
})
