import { defineConfig, devices } from '@playwright/test';

const deploymentURL = process.env.TODO_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: deploymentURL ?? 'http://127.0.0.1:4173/todo-list/',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(!deploymentURL && { webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173/todo-list/',
    reuseExistingServer: !process.env.CI,
  } }),
});
