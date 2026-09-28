import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs outside Next.js, so load .env files in Next's order (existing variables win).
const mode = process.env.NODE_ENV ?? 'development';
const envFiles = [`.env.${mode}.local`, ...(mode === 'test' ? [] : ['.env.local']), `.env.${mode}`, '.env'];
for (const file of envFiles) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Missing file: nothing to load.
  }
}

const LOCAL_DATABASE_URL = 'postgres://postgres:postgres@localhost:54329/wiege';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  schemaFilter: ['wiege'],
  // The production database is shared with another Drizzle app that owns
  // drizzle.__drizzle_migrations, so Wiege keeps its own history inside `wiege`.
  migrations: { schema: 'wiege', table: '__wiege_migrations' },
  dbCredentials: {
    url: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL || LOCAL_DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
