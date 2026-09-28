import 'server-only';

import Anthropic from '@anthropic-ai/sdk';

import { getEnv } from '@/lib/env';

/**
 * Anthropic client factory (SPEC §6). A client exists only when an API key or
 * auth token is configured; without one the app runs entirely on the offline
 * heuristic engine. The SDK retries 408/409/429/5xx and connection errors
 * itself (`maxRetries`), so callers make one call and fall back on failure.
 */

const globalForAi = globalThis as typeof globalThis & { __wiegeAnthropic?: Anthropic | null };

function credentials(): { apiKey?: string; authToken?: string } | null {
  const env = getEnv();
  if (env.ANTHROPIC_API_KEY) return { apiKey: env.ANTHROPIC_API_KEY };
  return env.ANTHROPIC_AUTH_TOKEN ? { authToken: env.ANTHROPIC_AUTH_TOKEN } : null;
}

/** The shared client, or null when no credentials are configured. */
export function getAnthropic(): Anthropic | null {
  if (globalForAi.__wiegeAnthropic === undefined) {
    const creds = credentials();
    globalForAi.__wiegeAnthropic = creds
      ? new Anthropic({ apiKey: creds.apiKey ?? null, authToken: creds.authToken ?? null, maxRetries: 2 })
      : null;
  }
  return globalForAi.__wiegeAnthropic;
}

export function aiAvailable(): boolean {
  return getAnthropic() !== null;
}

/** `WIEGE_AI_MODEL`, default `claude-opus-5`. */
export function aiModel(): string {
  return getEnv().WIEGE_AI_MODEL;
}

/** Test hook: forget the cached client so the next call re-reads the environment. */
export function resetAnthropicClient(): void {
  globalForAi.__wiegeAnthropic = undefined;
}
