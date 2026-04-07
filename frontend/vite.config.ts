import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function novncFix(): Plugin {
  return {
    name: 'novnc-top-level-await-fix',
    transform(code, id) {
      if (id.includes('@novnc/novnc/lib/util/browser.js')) {
        return code.replace(
          /exports\.supportsWebCodecsH264Decode\s*=\s*supportsWebCodecsH264Decode\s*=\s*await\s*_checkWebCodecsH264DecodeSupport\(\);/,
          'exports.supportsWebCodecsH264Decode = supportsWebCodecsH264Decode = false;'
        )
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), novncFix()],
  base: './',
  build: {
    outDir: 'dist',
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    include: ['@novnc/novnc/lib/rfb'],
  },
})
