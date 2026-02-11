import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json'],
    },
    server: {
        port: 3000,
        open: true,
    },
    build: {
        outDir: 'dist',
    },
});
