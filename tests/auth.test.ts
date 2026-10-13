import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, generateSessionToken } from '../lib/auth';

describe('Auth Utilities Tests', () => {
  it('generateSessionToken produces a 64-character hex string', () => {
    const token = generateSessionToken();
    assert.equal(typeof token, 'string');
    assert.equal(token.length, 64);
    assert.match(token, /^[0-9a-f]{64}$/);
  });

  it('hashPassword hashes and verifyPassword checks correctness', async () => {
    const password = 'SuperSecretPassword123!';
    const hash = await hashPassword(password);

    assert.notEqual(password, hash);
    assert.ok(hash.startsWith('$2')); // bcrypt prefix

    const isValid = await verifyPassword(password, hash);
    assert.equal(isValid, true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    assert.equal(isInvalid, false);
  });
});
