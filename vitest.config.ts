import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    exclude: ['node_modules', 'out', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/**',
        'tests/**',
        'out/**',
        'dist/**',
        '*.test.ts',
        '*.spec.ts',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
  resolve: {
    alias: {
      '@src': path.resolve(__dirname, './src'),
      '@test': path.resolve(__dirname, './tests'),
    },
    extensions: ['.ts', '.js', '.json'],
  },
});
