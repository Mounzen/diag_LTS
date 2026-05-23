import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config Vite : charge le plugin React pour transformer le JSX des .jsx.
// Sans ce fichier, `vite build` (Vite 8) n'applique pas @vitejs/plugin-react
// et le build avorte pendant la phase « building client environment ».
export default defineConfig({
  plugins: [react()],
});
