import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3020,
    fs: {
      // Allow serving files from the monorepo root (needed for pdfjs worker in node_modules)
      allow: [path.resolve(__dirname, '../..')]
    }
  },
  optimizeDeps: {
    include: [
      'pdfjs-dist',
      'react-image-crop',
      '@google/genai',
      'motion/react',
      'lucide-react'
    ]
  }
});
