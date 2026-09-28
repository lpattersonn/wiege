/**
 * CLI scripts run outside Next.js, so load the .env files in Next's order
 * (earlier files and variables already in the environment win). Import this first.
 */
const mode = process.env.NODE_ENV ?? 'development';
const envFiles = [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
for (const file of envFiles) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing file: nothing to load.
  }
}

export {};
