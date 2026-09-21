import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const raiz = (arquivo) => fileURLToPath(new URL(arquivo, import.meta.url))

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      input: {
        financeiro: raiz('./index.html'),
        orcamentos: raiz('./orcamentos.html'),
      },
    },
  },
})
