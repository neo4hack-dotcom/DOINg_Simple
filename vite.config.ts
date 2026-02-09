
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT pour Windows: base relative permet de charger les assets
  // même si l'app n'est pas à la racine du serveur web.
  base: './', 
  server: {
    port: 3000,
    host: true // Expose to network if needed
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Optimizations for smaller bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'lucide-react'],
        },
      },
    },
  },
});
