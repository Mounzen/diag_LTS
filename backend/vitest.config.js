import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
    // Exécution séquentielle : un seul process, pas d'écritures concurrentes sur db.test.json
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    setupFiles: ['tests/setup.js'],
    env: {
      NODE_ENV: 'test',
      DIAG_DB_PATH: 'data/db.test.json'
    }
  }
});
