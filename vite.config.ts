import { defineConfig, type Plugin } from 'vite';

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
    plugins: [stripRedundantFonts()],
    build: {
        // Inline tiny assets (<4 KB) to reduce HTTP requests
        assetsInlineLimit: 4096,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('/node_modules/katex/')) return 'katex';
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
