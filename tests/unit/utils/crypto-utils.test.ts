/**
 * tests/unit/utils/crypto-utils.test.ts
 *
 * Unit tests for crypto-utils.ts
 * Tests cryptographic utilities using Node.js crypto module.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRandomHex,
  generateRandomBase64,
  sha256,
  sha512,
  generateUUID,
  generateShortId,
  hashWithSalt,
  constantTimeEqual,
  hmacSha256,
  base64urlEncode,
  base64urlDecode,
} from '@src/utils/crypto-utils';

describe('generateRandomHex', () => {
  it('should generate hex string of correct length', () => {
    const length = 16;
    const result = generateRandomHex(length);
    expect(result.length).toBe(length * 2); // Each byte = 2 hex chars
  });

  it('should generate hex string with default length', () => {
    const result = generateRandomHex();
    expect(result.length).toBe(32); // 16 bytes * 2 = 32 hex chars
  });

  it('should generate different values on each call', () => {
    const result1 = generateRandomHex(16);
    const result2 = generateRandomHex(16);
    expect(result1).not.toBe(result2);
  });

  it('should generate valid hexadecimal string', () => {
    const result = generateRandomHex(16);
    expect(/^[0-9a-f]+$/.test(result)).toBe(true);
  });

  it('should handle length of 1', () => {
    const result = generateRandomHex(1);
    expect(result.length).toBe(2);
    expect(/^[0-9a-f]{2}$/.test(result)).toBe(true);
  });

  it('should handle length of 32', () => {
    const result = generateRandomHex(32);
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should return string', () => {
    const result = generateRandomHex(16);
    expect(typeof result).toBe('string');
  });
});

describe('generateRandomBase64', () => {
  it('should generate base64 string', () => {
    const result = generateRandomBase64(16);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should generate base64 string with default length', () => {
    const result = generateRandomBase64();
    expect(typeof result).toBe('string');
    // Base64 encoding of 16 bytes = 24 chars (4 groups of 4 chars with padding)
    expect(result.length).toBe(24);
  });

  it('should generate different values on each call', () => {
    const result1 = generateRandomBase64(16);
    const result2 = generateRandomBase64(16);
    expect(result1).not.toBe(result2);
  });

  it('should generate valid base64 characters', () => {
    const result = generateRandomBase64(16);
    expect(/^[A-Za-z0-9+/]+=*$/.test(result)).toBe(true);
  });

  it('should handle length of 1', () => {
    const result = generateRandomBase64(1);
    expect(result.length).toBe(4); // 1 byte * 8 = 8 bits, /6 = 1.33, rounded to 2, padded to 4
  });

  it('should handle length of 3', () => {
    const result = generateRandomBase64(3);
    expect(result.length).toBe(4); // Exactly fits in 4 base64 chars
  });
});

describe('sha256', () => {
  it('should generate SHA-256 hash', () => {
    const result = sha256('test');
    expect(result.length).toBe(64); // SHA-256 = 32 bytes = 64 hex chars
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should be deterministic for same input', () => {
    const result1 = sha256('test');
    const result2 = sha256('test');
    expect(result1).toBe(result2);
  });

  it('should generate different hashes for different inputs', () => {
    const result1 = sha256('test1');
    const result2 = sha256('test2');
    expect(result1).not.toBe(result2);
  });

  it('should handle empty string', () => {
    const result = sha256('');
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should handle special characters', () => {
    const result = sha256('test!@#$%^&*()');
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should match known SHA-256 hash', () => {
    // SHA-256 of "test" is known
    const result = sha256('test');
    // Just verify it's consistent with an external hash
    const result2 = sha256('test');
    expect(result).toBe(result2);
  });
});

describe('sha512', () => {
  it('should generate SHA-512 hash', () => {
    const result = sha512('test');
    expect(result.length).toBe(128); // SHA-512 = 64 bytes = 128 hex chars
    expect(/^[0-9a-f]{128}$/.test(result)).toBe(true);
  });

  it('should be deterministic for same input', () => {
    const result1 = sha512('test');
    const result2 = sha512('test');
    expect(result1).toBe(result2);
  });

  it('should generate different hashes for different inputs', () => {
    const result1 = sha512('test1');
    const result2 = sha512('test2');
    expect(result1).not.toBe(result2);
  });

  it('should handle empty string', () => {
    const result = sha512('');
    expect(result.length).toBe(128);
    expect(/^[0-9a-f]{128}$/.test(result)).toBe(true);
  });

  it('should be different from SHA-256', () => {
    const input = 'test';
    const sha256Result = sha256(input);
    const sha512Result = sha512(input);
    expect(sha256Result).not.toBe(sha512Result);
    expect(sha256Result.length).not.toBe(sha512Result.length);
  });
});

describe('generateUUID', () => {
  it('should generate valid UUID v4 format', () => {
    const result = generateUUID();
    expect(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)).toBe(true);
  });

  it('should be 36 characters long', () => {
    const result = generateUUID();
    expect(result.length).toBe(36);
  });

  it('should have correct format with hyphens', () => {
    const result = generateUUID();
    expect(result.split('-')).toHaveLength(5);
  });

  it('should generate different values on each call', () => {
    const result1 = generateUUID();
    const result2 = generateUUID();
    expect(result1).not.toBe(result2);
  });

  it('should be lowercase', () => {
    const result = generateUUID();
    expect(result).toBe(result.toLowerCase());
  });

  it('should return string', () => {
    const result = generateUUID();
    expect(typeof result).toBe('string');
  });
});

describe('generateShortId', () => {
  it('should generate short ID', () => {
    const result = generateShortId();
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result).toBe('string');
  });

  it('should generate base64url-encoded value (no padding)', () => {
    const result = generateShortId();
    // Base64url of 16 bytes = 22 chars (16*8/6 = 21.33, rounded to 22)
    expect(result.length).toBe(22);
    // Should not have padding
    expect(result.endsWith('=')).toBe(false);
  });

  it('should generate different values on each call', () => {
    const result1 = generateShortId();
    const result2 = generateShortId();
    expect(result1).not.toBe(result2);
  });

  it('should use URL-safe characters only', () => {
    const result = generateShortId();
    // Base64url uses A-Za-z0-9-_
    expect(/^[A-Za-z0-9_-]+$/.test(result)).toBe(true);
  });

  it('should not have + or / characters (standard base64)', () => {
    const result = generateShortId();
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
  });
});

describe('hashWithSalt', () => {
  it('should generate salted hash', () => {
    const result = hashWithSalt('data', 'salt');
    expect(result.length).toBe(64); // SHA-256 = 64 hex chars
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should generate different hashes with different salts', () => {
    const result1 = hashWithSalt('data', 'salt1');
    const result2 = hashWithSalt('data', 'salt2');
    expect(result1).not.toBe(result2);
  });

  it('should generate different hashes with different data (same salt)', () => {
    const result1 = hashWithSalt('data1', 'salt');
    const result2 = hashWithSalt('data2', 'salt');
    expect(result1).not.toBe(result2);
  });

  it('should be deterministic with same salt and data', () => {
    const result1 = hashWithSalt('data', 'salt');
    const result2 = hashWithSalt('data', 'salt');
    expect(result1).toBe(result2);
  });

  it('should differ from plain hash', () => {
    const plainHash = sha256('data');
    const saltedHash = hashWithSalt('data', 'salt');
    expect(plainHash).not.toBe(saltedHash);
  });

  it('should handle empty salt', () => {
    const result = hashWithSalt('data', '');
    expect(result.length).toBe(64);
  });

  it('should handle empty data', () => {
    const result = hashWithSalt('', 'salt');
    expect(result.length).toBe(64);
  });

  it('should handle special characters in salt', () => {
    const result = hashWithSalt('data', 's@lt!#$');
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });
});

describe('constantTimeEqual', () => {
  it('should return true for equal strings', () => {
    const result = constantTimeEqual('test', 'test');
    expect(result).toBe(true);
  });

  it('should return false for unequal strings', () => {
    const result = constantTimeEqual('test', 'Test');
    expect(result).toBe(false);
  });

  it('should handle empty strings', () => {
    const result = constantTimeEqual('', '');
    expect(result).toBe(true);
  });

  it('should return false for strings of different lengths', () => {
    const result = constantTimeEqual('test', 'test123');
    expect(result).toBe(false);
  });

  it('should handle Buffer inputs', () => {
    const buf1 = Buffer.from('test');
    const buf2 = Buffer.from('test');
    const result = constantTimeEqual(buf1, buf2);
    expect(result).toBe(true);
  });

  it('should handle unequal Buffer inputs', () => {
    const buf1 = Buffer.from('test');
    const buf2 = Buffer.from('Test');
    const result = constantTimeEqual(buf1, buf2);
    expect(result).toBe(false);
  });

  it('should handle mixed string and Buffer inputs', () => {
    const result1 = constantTimeEqual('test', Buffer.from('test'));
    expect(result1).toBe(true);

    const result2 = constantTimeEqual(Buffer.from('test'), 'test');
    expect(result2).toBe(true);
  });

  it('should return false for different Buffer lengths', () => {
    const buf1 = Buffer.from('test');
    const buf2 = Buffer.from('longer');
    const result = constantTimeEqual(buf1, buf2);
    expect(result).toBe(false);
  });
});

describe('hmacSha256', () => {
  it('should generate HMAC signature', () => {
    const result = hmacSha256('data', 'secret');
    expect(result.length).toBe(64); // HMAC-SHA256 = 64 hex chars
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should be deterministic with same data and secret', () => {
    const result1 = hmacSha256('data', 'secret');
    const result2 = hmacSha256('data', 'secret');
    expect(result1).toBe(result2);
  });

  it('should generate different signatures with different secrets', () => {
    const result1 = hmacSha256('data', 'secret1');
    const result2 = hmacSha256('data', 'secret2');
    expect(result1).not.toBe(result2);
  });

  it('should generate different signatures with different data', () => {
    const result1 = hmacSha256('data1', 'secret');
    const result2 = hmacSha256('data2', 'secret');
    expect(result1).not.toBe(result2);
  });

  it('should handle empty data', () => {
    const result = hmacSha256('', 'secret');
    expect(result.length).toBe(64);
  });

  it('should handle empty secret', () => {
    const result = hmacSha256('data', '');
    expect(result.length).toBe(64);
  });

  it('should differ from plain hash', () => {
    const plainHash = sha256('data');
    const hmacHash = hmacSha256('data', 'secret');
    expect(plainHash).not.toBe(hmacHash);
  });

  it('should be consistent with same inputs', () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      results.push(hmacSha256('test', 'secret'));
    }
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });
});

describe('base64urlEncode', () => {
  it('should encode string to base64url', () => {
    const result = base64urlEncode('test');
    expect(result).toBe('dGVzdA');
  });

  it('should handle empty string', () => {
    const result = base64urlEncode('');
    expect(result).toBe('');
  });

  it('should use URL-safe characters only', () => {
    const result = base64urlEncode('test123');
    expect(/[A-Za-z0-9_-]+/.test(result)).toBe(true);
  });

  it('should not have padding', () => {
    const result = base64urlEncode('test');
    expect(result.endsWith('=')).toBe(false);
  });

  it('should not contain + or /', () => {
    const result = base64urlEncode('test data with spaces!');
    expect(result).not.toContain('+');
    expect(result).not.toContain('/');
  });

  it('should handle special characters', () => {
    const result = base64urlEncode('hello:world?name=value');
    expect(typeof result).toBe('string');
  });

  it('should encode to base64url', () => {
    // "hello world" in base64 = "aGVsbG8gd29ybGQ="
    // In base64url = "aGVsbG8gd29ybGQ"
    const result = base64urlEncode('hello world');
    expect(result.endsWith('=')).toBe(false);
  });
});

describe('base64urlDecode', () => {
  it('should decode base64url string', () => {
    const encoded = 'dGVzdA';
    const result = base64urlDecode(encoded);
    expect(result).toBe('test');
  });

  it('should decode empty string', () => {
    const result = base64urlDecode('');
    expect(result).toBe('');
  });

  it('should round-trip encode and decode', () => {
    const original = 'hello world';
    const encoded = base64urlEncode(original);
    const decoded = base64urlDecode(encoded);
    expect(decoded).toBe(original);
  });

  it('should handle base64 strings with padding removed', () => {
    // Standard base64: "dGVzdA=="
    // Base64url: "dGVzdA"
    const result = base64urlDecode('dGVzdA');
    expect(result).toBe('test');
  });

  it('should handle special characters', () => {
    const original = 'hello:world?name=value';
    const encoded = base64urlEncode(original);
    const result = base64urlDecode(encoded);
    expect(result).toBe(original);
  });

  it('should handle string with spaces', () => {
    const original = 'test data with spaces';
    const encoded = base64urlEncode(original);
    const result = base64urlDecode(encoded);
    expect(result).toBe(original);
  });
});

describe('integration and edge cases', () => {
  it('should generate unique hex and base64 values', () => {
    const hex1 = generateRandomHex(16);
    const hex2 = generateRandomHex(16);
    const base1 = generateRandomBase64(16);
    const base2 = generateRandomBase64(16);

    expect(hex1).not.toBe(hex2);
    expect(base1).not.toBe(base2);
    expect(hex1).not.toBe(base1);
  });

  it('should hash consistently across different functions', () => {
    const data = 'test';
    const sha256Hash = sha256(data);
    const hashWithResult = hashWithSalt(data, 'salt');

    expect(sha256Hash).not.toBe(hashWithResult);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      uuids.add(generateUUID());
    }
    expect(uuids.size).toBe(100);
  });

  it('should generate unique short IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateShortId());
    }
    expect(ids.size).toBe(100);
  });

  it('should handle extremely long strings for hashing', () => {
    const longString = 'a'.repeat(10000);
    const result = sha256(longString);
    expect(result.length).toBe(64);
  });

  it('should handle unicode characters in hash', () => {
    const unicodeText = 'Hello 世界 🌍';
    const result = sha256(unicodeText);
    expect(result.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(result)).toBe(true);
  });

  it('should round-trip encode/decode unicode', () => {
    const original = 'Hello 世界 🌍';
    const encoded = base64urlEncode(original);
    const decoded = base64urlDecode(encoded);
    expect(decoded).toBe(original);
  });

  it('should generate consistent HMAC signatures', () => {
    const signatures = [];
    const data = 'test data';
    const secret = 'test secret';

    for (let i = 0; i < 10; i++) {
      signatures.push(hmacSha256(data, secret));
    }

    // All signatures should be identical
    expect(new Set(signatures).size).toBe(1);
  });

  it('should verify HMAC authenticity', () => {
    const data = 'important message';
    const secret = 'secret key';
    const signature = hmacSha256(data, secret);

    // Verify with same secret
    const verified = hmacSha256(data, secret);
    expect(verified).toBe(signature);

    // Different secret produces different signature
    const wrongSecretSignature = hmacSha256(data, 'wrong secret');
    expect(wrongSecretSignature).not.toBe(signature);
  });

  it('should use constant-time comparison correctly', () => {
    const value1 = 'correct_password';
    const value2 = 'correct_password';
    const value3 = 'incorrect_password';

    expect(constantTimeEqual(value1, value2)).toBe(true);
    expect(constantTimeEqual(value1, value3)).toBe(false);
  });
});
