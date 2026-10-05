import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Esri Topographic
      '/tiles/esri-topo': {
        target: 'https://server.arcgisonline.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/tiles\/esri-topo/,
            '/ArcGIS/rest/services/World_Topo_Map/MapServer/tile'
          ),
      },

      // Esri Satellite Imagery
      '/tiles/esri-imagery': {
        target: 'https://server.arcgisonline.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/tiles\/esri-imagery/,
            '/ArcGIS/rest/services/World_Imagery/MapServer/tile'
          ),
      },

      // Esri Street
      '/tiles/esri-street': {
        target: 'https://server.arcgisonline.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/tiles\/esri-street/,
            '/ArcGIS/rest/services/World_Street_Map/MapServer/tile'
          ),
      },

      // Esri Terrain
      '/tiles/esri-terrain': {
        target: 'https://server.arcgisonline.com',
        changeOrigin: true,
        rewrite: (path) =>
          path.replace(
            /^\/tiles\/esri-terrain/,
            '/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile'
          ),
      },

      // OpenStreetMap
      '/tiles/osm': {
        target: 'https://tile.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/osm/, ''),
      },

      // Humanitarian OpenStreetMap
      '/tiles/hot': {
        target: 'https://a.tile.openstreetmap.fr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tiles\/hot/, '/hot'),
      },
    },
  },
})