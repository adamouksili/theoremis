import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/__tests__/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: [
                'src/__tests__/**',
                'src/styles/**',
                'src/types/**',
                'src/**/*.d.ts',
                'src/ide/**',
                'src/main.ts',
                'src/bridge/lean-server.ts',
                'src/bridge/moogle-search.ts',
                'src/engine/llm.ts',
                'src/formal/runtime/queue.ts',
                'src/formal/runtime/worker.ts',
            ],
            reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
            reportsDirectory: 'coverage',
            thresholds: {
                statements: 70,
                branches: 60,
                functions: 65,
                lines: 70,
            },
        },
    },
});
