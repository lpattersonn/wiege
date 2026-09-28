import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CRON_BUDGET_MS,
  authorizeCronRequest,
  bearerToken,
  cronBudgetMs,
  isLoopbackRequest,
  isServerlessRuntime,
  parseCronQuery,
  secretsMatch,
} from './cron';

const SECRET = 'a-long-random-cron-secret-value';

const request = (url: string, headers: Record<string, string> = {}) => ({ url, headers: new Headers(headers) });

describe('authorizeCronRequest', () => {
  it('accepts the bearer secret in any environment', () => {
    const req = request('https://wiege.example/api/cron/ingest', { authorization: `Bearer ${SECRET}` });
    expect(authorizeCronRequest(req, { secret: SECRET, nodeEnv: 'production' })).toEqual({ ok: true, via: 'secret' });
  });

  it('rejects a wrong, missing or malformed token', () => {
    for (const authorization of ['Bearer wrong-secret-value-123456', `Basic ${SECRET}`, `Bearer ${SECRET} extra`, '']) {
      const req = request('https://wiege.example/api/cron/ingest', authorization ? { authorization } : {});
      expect(authorizeCronRequest(req, { secret: SECRET, nodeEnv: 'production' })).toEqual({ ok: false, reason: 'unauthorized' });
    }
  });

  it('says when no secret is configured', () => {
    const req = request('https://wiege.example/api/cron/ingest', { authorization: 'Bearer anything' });
    expect(authorizeCronRequest(req, { secret: undefined, nodeEnv: 'production' })).toEqual({ ok: false, reason: 'not-configured' });
  });

  it('allows localhost without a secret only in development', () => {
    const local = request('http://localhost:3000/api/cron/ingest');
    expect(authorizeCronRequest(local, { secret: undefined, nodeEnv: 'development' })).toEqual({ ok: true, via: 'development-localhost' });
    expect(authorizeCronRequest(local, { secret: undefined, nodeEnv: 'production' }).ok).toBe(false);
    expect(authorizeCronRequest(local, { secret: SECRET, nodeEnv: 'test' }).ok).toBe(false);
  });

  it('does not treat proxied or remote requests as local in development', () => {
    const proxied = request('http://localhost:3000/api/cron/ingest', { 'x-forwarded-for': '203.0.113.9' });
    expect(authorizeCronRequest(proxied, { secret: undefined, nodeEnv: 'development' }).ok).toBe(false);
    const remote = request('http://192.168.1.20:3000/api/cron/ingest');
    expect(authorizeCronRequest(remote, { secret: undefined, nodeEnv: 'development' }).ok).toBe(false);
  });
});

describe('request helpers', () => {
  it('bearerToken parses one token', () => {
    expect(bearerToken('Bearer abc')).toBe('abc');
    expect(bearerToken('bearer   abc  ')).toBe('abc');
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });

  it('secretsMatch compares exactly, whatever the lengths', () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
    expect(secretsMatch(`${SECRET}x`, SECRET)).toBe(false);
    expect(secretsMatch('', SECRET)).toBe(false);
  });

  it('isLoopbackRequest knows the loopback names', () => {
    expect(isLoopbackRequest(request('http://127.0.0.1:3000/x'))).toBe(true);
    expect(isLoopbackRequest(request('http://[::1]:3000/x'))).toBe(true);
    expect(isLoopbackRequest(request('http://localhost/x', { 'x-forwarded-for': '127.0.0.1, ::1' }))).toBe(true);
    expect(isLoopbackRequest(request('https://wiege.example/x'))).toBe(false);
  });

  it('parseCronQuery validates revalidateOnly and ignores other parameters', () => {
    expect(parseCronQuery(new URLSearchParams(''))).toEqual({ revalidateOnly: false });
    expect(parseCronQuery(new URLSearchParams('revalidateOnly=1&x=y'))).toEqual({ revalidateOnly: true });
    expect(parseCronQuery(new URLSearchParams('revalidateOnly=true'))).toEqual({ revalidateOnly: true });
    expect(parseCronQuery(new URLSearchParams('revalidateOnly=0'))).toEqual({ revalidateOnly: false });
    expect(parseCronQuery(new URLSearchParams('revalidateOnly=yes please'))).toBeNull();
  });
});

describe('host detection and budgets', () => {
  it('recognises Netlify and Vercel, including Netlify functions that lack NETLIFY at runtime', () => {
    expect(isServerlessRuntime({})).toBe(false);
    expect(isServerlessRuntime({ NETLIFY: 'true' })).toBe(true);
    expect(isServerlessRuntime({ VERCEL: '1' })).toBe(true);
    expect(isServerlessRuntime({ AWS_LAMBDA_FUNCTION_NAME: '___netlify-server-handler' })).toBe(true);
  });

  it('gives cron runs a budget on serverless hosts only, unless one is configured', () => {
    expect(cronBudgetMs({})).toBeUndefined();
    expect(cronBudgetMs({ VERCEL: '1' })).toBe(DEFAULT_CRON_BUDGET_MS);
    expect(cronBudgetMs({ WIEGE_INGEST_BUDGET_MS: '45000' })).toBe(45_000);
    expect(cronBudgetMs({ NETLIFY: 'true', WIEGE_INGEST_BUDGET_MS: '15000' })).toBe(15_000);
    expect(cronBudgetMs({ NETLIFY: 'true', WIEGE_INGEST_BUDGET_MS: 'soon' })).toBe(DEFAULT_CRON_BUDGET_MS);
  });
});
