// vite.config.ts
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig(async () => {
  const reactPlugin = (await import('@vitejs/plugin-react')).default

  return {
    plugins: [reactPlugin()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
    server: {
      open: '/employee.html',
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          employee: path.resolve(__dirname, 'employee.html'),
          upload: path.resolve(__dirname, 'upload.html'),
        },
      },
    },
  }
})
