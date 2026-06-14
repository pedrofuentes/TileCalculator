import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is the project-pages subpath in production (served from
// https://pedrofuentes.github.io/TileCalculator/) and root during local dev.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/TileCalculator/' : '/',
  plugins: [react()],
}))
