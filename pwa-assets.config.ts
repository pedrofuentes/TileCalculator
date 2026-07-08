import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates public/pwa-*.png, public/maskable-icon-*.png, public/apple-touch-icon-*.png
// from public/favicon.svg. Re-run via `npm run generate-pwa-assets` if the source SVG changes.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/favicon.svg'],
})
