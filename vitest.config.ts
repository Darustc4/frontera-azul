import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['tests/game.test.ts'],
        tsconfig: './tsconfig.tests.json',
    },
});
