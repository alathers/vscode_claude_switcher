/**
 * tests/unit/utils/crypto-utils.test.ts
 *
 * Crypto Utilities Unit Tests
 *
 * Tests hash and redaction helpers for secrets (no VS Code API imports).
 */

import { describe, it, expect } from 'vitest';
import { CryptoUtils } from '../../../src/utils/crypto-utils.js';

describe('CryptoUtils', () => {
  describe('Hash Secrets', () => {
    it('should hash a secret string', () => {
      const secret = 'sk-ant-api03-12345';
      const hash = CryptoUtils.hashSecret(secret);

      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).not.toBe(secret); // Hash should not equal original
    });

    it('should produce consistent hash for same input', () => {
      const secret = 'sk-ant-api03-12345';
      const hash1 = CryptoUtils.hashSecret(secret);
      const hash2 = CryptoUtils.hashSecret(secret);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different inputs', () => {
      const secret1 = 'sk-ant-api03-12345';
      const secret2 = 'sk-ant-api03-67890';

      const hash1 = CryptoUtils.hashSecret(secret1);
      const hash2 = CryptoUtils.hashSecret(secret2);

      expect(hash1).not.toBe(hash2);
    });

    it('should hash empty string', () => {
      const hash = CryptoUtils.hashSecret('');

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should hash special characters', () => {
      const secret = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./';
      const hash = CryptoUtils.hashSecret(secret);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should handle Unicode characters', () => {
      const secret = '秘钥密码';
      const hash = CryptoUtils.hashSecret(secret);

      expect(hash).toBeDefined();
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('Redact Secrets', () => {
    it('should redact secret and replace with placeholder', () => {
      const secret = 'sk-ant-api03-12345';
      const redacted = CryptoUtils.redactSecret(secret);

      expect(redacted).toBe('[REDACTED]');
    });

    it('should show custom placeholder', () => {
      const secret = 'sk-ant-api03-12345';
      const redacted = CryptoUtils.redactSecret(secret, '***HIDDEN***');

      expect(redacted).toBe('***HIDDEN***');
    });

    it('should handle null and undefined', () => {
      expect(CryptoUtils.redactSecret(null as unknown as string)).toBe('[REDACTED]');
      expect(CryptoUtils.redactSecret(undefined as unknown as string)).toBe('[REDACTED]');
    });

    it('should handle empty string', () => {
      expect(CryptoUtils.redactSecret('')).toBe('[REDACTED]');
    });
  });

  describe('Redact From String', () => {
    it('should redact secret pattern in string', () => {
      const text = 'Auth token: sk-ant-api03-12345';
      const patterns = [/sk-ant-[a-zA-Z0-9-]+/g];
      const redacted = CryptoUtils.redactFromString(text, patterns);

      expect(redacted).toBe('Auth token: [REDACTED]');
      expect(redacted).not.toContain('sk-ant-api03-12345');
    });

    it('should redact multiple occurrences', () => {
      const text = 'Token1: sk-ant-api03-12345, Token2: sk-ant-api03-67890';
      const patterns = [/sk-ant-[a-zA-Z0-9-]+/g];
      const redacted = CryptoUtils.redactFromString(text, patterns);

      expect(redacted).toContain('[REDACTED]');
      expect(redacted.split('[REDACTED]')).toHaveLength(3); // 2 redactions
    });

    it('should handle multiple patterns', () => {
      const text = 'API key: my-secret-key, Token: sk-ant-123';
      const patterns = [/my-secret-.+/, /sk-ant-.+/];
      const redacted = CryptoUtils.redactFromString(text, patterns);

      expect(redacted).not.toContain('my-secret-key');
      expect(redacted).not.toContain('sk-ant-123');
      expect(redacted).toContain('[REDACTED]');
    });

    it('should leave text unchanged if no patterns match', () => {
      const text = 'No secrets here';
      const patterns = [/sk-ant-.+/];
      const redacted = CryptoUtils.redactFromString(text, patterns);

      expect(redacted).toBe(text);
    });

    it('should handle empty patterns array', () => {
      const text = 'Some text';
      const patterns: RegExp[] = [];
      const redacted = CryptoUtils.redactFromString(text, patterns);

      expect(redacted).toBe(text);
    });

    it('should use custom placeholder', () => {
      const text = 'Token: sk-ant-123';
      const patterns = [/sk-ant-.+/];
      const redacted = CryptoUtils.redactFromString(text, patterns, '***');

      expect(redacted).toBe('Token: ***');
    });
  });

  describe('Redact From Object', () => {
    it('should redact secret keys in object', () => {
      const obj = {
        name: 'endpoint',
        authToken: 'sk-ant-123',
        url: 'https://api.example.com',
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['authToken']);

      expect(redacted.name).toBe('endpoint');
      expect(redacted.authToken).toBe('[REDACTED]');
      expect(redacted.url).toBe('https://api.example.com');
    });

    it('should redact multiple secret keys', () => {
      const obj = {
        authToken: 'sk-ant-123',
        apiKey: 'secret-key',
        normal: 'value',
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['authToken', 'apiKey']);

      expect(redacted.authToken).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.normal).toBe('value');
    });

    it('should redact nested objects', () => {
      const obj = {
        config: {
          authToken: 'secret',
          url: 'https://api.example.com',
        },
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['authToken']);

      expect(redacted.config.authToken).toBe('[REDACTED]');
      expect(redacted.config.url).toBe('https://api.example.com');
    });

    it('should redact values in arrays', () => {
      const obj = {
        tokens: ['token1', 'secret-token', 'token3'],
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['secret-token']);

      expect(redacted.tokens[1]).toBe('[REDACTED]');
      expect(redacted.tokens[0]).toBe('token1');
    });

    it('should handle deep nesting', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              secret: 'value',
              normal: 'value2',
            },
          },
        },
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['secret']);

      expect(redacted.level1.level2.level3.secret).toBe('[REDACTED]');
      expect(redacted.level1.level2.level3.normal).toBe('value2');
    });

    it('should handle arrays of objects', () => {
      const obj = {
        endpoints: [
          { name: 'ep1', token: 'secret1' },
          { name: 'ep2', token: 'secret2' },
        ],
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['token']);

      expect(redacted.endpoints[0].token).toBe('[REDACTED]');
      expect(redacted.endpoints[1].token).toBe('[REDACTED]');
    });

    it('should return same object structure if no secrets to redact', () => {
      const obj = {
        name: 'value',
        url: 'https://example.com',
      };
      const redacted = CryptoUtils.redactFromObject(obj, ['authToken']);

      expect(redacted).toEqual(obj);
    });

    it('should use custom placeholder', () => {
      const obj = { authToken: 'secret' };
      const redacted = CryptoUtils.redactFromObject(obj, ['authToken'], '***');

      expect(redacted.authToken).toBe('***');
    });
  });

  describe('Common Secret Patterns', () => {
    it('should detect API key patterns', () => {
      const patterns = CryptoUtils.getCommonSecretPatterns();

      expect(patterns.length).toBeGreaterThan(0);

      // Test that common patterns include expected regex
      const hasApiKeyPattern = patterns.some(
        (p) => p.source.includes('api') || p.source.includes('key')
      );
      expect(hasApiKeyPattern).toBe(true);
    });

    it('should include auth token patterns', () => {
      const patterns = CryptoUtils.getCommonSecretPatterns();

      const hasAuthPattern = patterns.some((p) => p.source.includes('key') || p.source.includes('bearer'));
      expect(hasAuthPattern).toBe(true);
    });
  });

  describe('Safe Hash Lengths', () => {
    it('should produce consistent hash lengths', () => {
      const secrets = Array.from({ length: 100 }, (_, i) => `secret-${i}`);
      const hashes = secrets.map((s) => CryptoUtils.hashSecret(s));

      const uniqueLengths = new Set(hashes.map((h) => h.length));
      expect(uniqueLengths.size).toBe(1); // All hashes same length
    });

    it('should produce unique hashes for different inputs', () => {
      const secrets = Array.from({ length: 1000 }, (_, i) => `secret-${i}`);
      const hashes = secrets.map((s) => CryptoUtils.hashSecret(s));

      const uniqueHashes = new Set(hashes);
      expect(uniqueHashes.size).toBe(1000); // All unique
    });
  });
});
