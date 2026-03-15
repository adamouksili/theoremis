import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Strip redundant KaTeX font formats.
 * WOFF2 is supported by every modern browser; TTF and WOFF just add ~876 KB of dead weight.
 */
function stripRedundantFonts(): Plugin {
    return {
        name: 'strip-redundant-fonts',
        generateBundle(_options, bundle) {
            for (const key of Object.keys(bundle)) {
                if (/KaTeX.*\.(ttf|woff)$/i.test(key) && !/\.woff2$/i.test(key)) {
                    delete bundle[key];
                }
            }
        },
    };
}

export default defineConfig({
    server: {
        port: 5173,
        open: false,
    },
    plugins: [react(), tailwindcss(), stripRedundantFonts()],
    build: {
        target: 'es2022',
        sourcemap: 'hidden',
        assetsInlineLimit: 4096,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('/node_modules/katex/')) return 'katex';
                    if (id.includes('/node_modules/three/')) return 'three';
                    if (id.includes('/node_modules/@react-three/')) return 'r3f';
                    if (id.includes('/node_modules/react') || id.includes('/node_modules/scheduler/')) return 'react-vendor';
                    if (id.includes('/node_modules/framer-motion/')) return 'framer';
                    if (id.includes('/src/ide/landing-page/')) return 'landing-react';
                    if (id.includes('/src/ide/')) return 'ide';
                    if (id.includes('/src/parser/') || id.includes('/src/engine/') || id.includes('/src/core/')) {
                        return 'math-core';
                    }
                    return undefined;
                },
            },
        },
    },
});
