import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRateLimit,
  resetRateLimit,
  clearRateLimits,
  getClientIp,
} from '../lib/rate-limit';
import { sameOrigin } from '../lib/integration-keys';
import { verifyPassword, DUMMY_PASSWORD_HASH } from '../lib/auth';

describe('Security & Rate Limiting Tests', () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it('allows requests within limit and tracks remaining quota', () => {
    const key = 'test:ip:1';
    const r1 = checkRateLimit(key, 3, 60);
    assert.equal(r1.success, true);
    assert.equal(r1.remaining, 2);

    const r2 = checkRateLimit(key, 3, 60);
    assert.equal(r2.success, true);
    assert.equal(r2.remaining, 1);

    const r3 = checkRateLimit(key, 3, 60);
    assert.equal(r3.success, true);
    assert.equal(r3.remaining, 0);

    // 4th request exceeds limit
    const r4 = checkRateLimit(key, 3, 60);
    assert.equal(r4.success, false);
    assert.equal(r4.remaining, 0);
    assert.ok(r4.resetSeconds > 0 && r4.resetSeconds <= 60);
  });

  it('resets rate limit on resetRateLimit call', () => {
    const key = 'test:ip:2';
    checkRateLimit(key, 2, 60);
    checkRateLimit(key, 2, 60);
    assert.equal(checkRateLimit(key, 2, 60).success, false);

    resetRateLimit(key);
    assert.equal(checkRateLimit(key, 2, 60).success, true);
  });

  it('extracts client IP properly from headers', () => {
    // 1. Direct standard req
    const req1 = new Request('http://localhost:3000/api/auth/login');
    assert.equal(getClientIp(req1), '127.0.0.1');

    // 2. Behind proxy with X-Forwarded-For (multi IP chain)
    const req2 = new Request('http://localhost:3000/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' },
    });
    assert.equal(getClientIp(req2), '203.0.113.195');

    // 3. Behind proxy with X-Real-IP
    const req3 = new Request('http://localhost:3000/api/auth/login', {
      headers: { 'x-real-ip': '198.51.100.42' },
    });
    assert.equal(getClientIp(req3), '198.51.100.42');
  });

  it('validates sameOrigin with direct access and reverse proxies', () => {
    // 1. Same origin match
    const req1 = new Request('http://137.131.245.249:3000/api/integrations/keys', {
      headers: { origin: 'http://137.131.245.249:3000' },
    });
    assert.equal(sameOrigin(req1), true);

    // 2. Behind reverse proxy where internal req.url is localhost but Host header matches origin
    const req2 = new Request('http://localhost:3000/api/integrations/keys', {
      headers: {
        origin: 'https://mi-dominio.com',
        host: 'mi-dominio.com',
      },
    });
    assert.equal(sameOrigin(req2), true);

    // 3. Cross-origin attack attempt
    const req3 = new Request('http://137.131.245.249:3000/api/integrations/keys', {
      headers: {
        origin: 'https://sitio-malicioso.com',
        host: '137.131.245.249:3000',
      },
    });
    assert.equal(sameOrigin(req3), false);
  });

  it('DUMMY_PASSWORD_HASH safely fails verification for timing-attack protection', async () => {
    const isValid = await verifyPassword('AnyRandomPasswordAttempt123', DUMMY_PASSWORD_HASH);
    assert.equal(isValid, false);
  });
});
