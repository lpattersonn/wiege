import Anthropic from '@anthropic-ai/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetEnvCache } from '@/lib/env';

import { aiAvailable, aiModel, getAnthropic, resetAnthropicClient } from './client';

function reset() {
  resetEnvCache();
  resetAnthropicClient();
}

beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY', '');
  vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '');
  vi.stubEnv('WIEGE_AI_MODEL', '');
  reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  reset();
});

describe('Anthropic client', () => {
  it('is unavailable without credentials', () => {
    expect(getAnthropic()).toBeNull();
    expect(aiAvailable()).toBe(false);
  });

  it('is created once from an API key', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-key');
    reset();
    const client = getAnthropic();
    expect(client).toBeInstanceOf(Anthropic);
    expect(getAnthropic()).toBe(client);
    expect(aiAvailable()).toBe(true);
  });

  it('accepts an auth token instead of a key', () => {
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'token-value');
    reset();
    expect(getAnthropic()).toBeInstanceOf(Anthropic);
  });

  it('treats whitespace-only credentials as missing', () => {
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', '   ');
    reset();
    expect(aiAvailable()).toBe(false);
  });

  it('uses claude-opus-5 unless WIEGE_AI_MODEL overrides it', () => {
    expect(aiModel()).toBe('claude-opus-5');
    vi.stubEnv('WIEGE_AI_MODEL', 'claude-opus-4-8');
    reset();
    expect(aiModel()).toBe('claude-opus-4-8');
  });
});
