import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.UI_URL || 'http://localhost:5173',
    headless: true,
  },
});
