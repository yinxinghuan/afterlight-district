import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const root = path.dirname(fileURLToPath(import.meta.url))

function guestIndex(): Plugin {
  return {
    name: 'guest-index',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url ?? ''
        const pathOnly = url.split('?')[0]
        if (pathOnly === '/' || pathOnly === '/index.html') {
          const query = url.includes('?') ? url.slice(url.indexOf('?')) : ''
          req.url = `/index.guest.html${query}`
        }
        next()
      })
    },
    closeBundle() {
      const from = path.join(root, 'dist-guest/index.guest.html')
      const to = path.join(root, 'dist-guest/index.html')
      if (fs.existsSync(from)) {
        fs.copyFileSync(from, to)
        fs.unlinkSync(from)
      }
      const out = path.join(root, 'dist-guest')
      const drop = [
        'alteru-storage-scope.js',
        'poster.png',
        'models/monsters__werewolf.glb',
        'models/monsters__zombie.glb',
        'models/office__securityGuard.glb',
        'models/office__securityGuard.png',
        'models/people__afterlightJo.png',
        'models/people__afterlightLin.png',
        'models/people__worker.glb',
        'models/people__worker.png',
        'models/plants__roundTree.glb',
        'models/scene__house.glb',
        'models/scene__lamp.glb',
        'models/scene__roadTile.glb',
        'models/scene__grassTile.glb',
        'models/scene__fence.glb',
      ]
      for (const rel of drop) {
        const file = path.join(out, rel)
        if (fs.existsSync(file)) fs.unlinkSync(file)
      }
    },
  }
}

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [react(), guestIndex()],
  build: {
    outDir: 'dist-guest',
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(root, 'index.guest.html'),
    },
  },
})
