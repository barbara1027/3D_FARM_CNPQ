// 3d-farm-ui/vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url'; 
import path from 'path'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Define @/ como um caminho absoluto para a pasta src
      '@/': path.resolve(__dirname, './src/'), 
    },
  },
});