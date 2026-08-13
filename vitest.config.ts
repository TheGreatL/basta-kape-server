import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        tsconfigPaths: true
    },
    test: {
        exclude: ['dist/**', 'node_modules/**'],
        testTimeout: 30000,
        hookTimeout: 30000
    }
});
