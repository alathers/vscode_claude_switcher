/**
 * tests/unit/core/audit/redaction-engine.test.ts
 *
 * Unit tests for redaction-engine.ts
 * Tests secret and PII redaction logic.
 */

import { describe, it, expect } from 'vitest';
import { RedactionEngine, redactSensitiveContent, redactWithResult } from '@src/core/audit/redaction-engine';

describe('RedactionEngine', () => {
  describe('Built-in rules', () => {
    it('should redact Anthropic API keys', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('API key: sk-ant-api1234567890abcdefghijklmnopqrstuvwxyz');

      expect(result.redacted).not.toContain('sk-ant-api1234567890abcdefghijklmnopqrstuvwxyz');
      expect(result.redacted).toContain('[REDACTED: API_KEY]');
      expect(result.matchedPatterns).toContain('api-key-anthropic');
    });

    it('should redact OpenAI API keys', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('API key: sk-abcdefghijklmnopqrstuvwxyz1234567890');

      expect(result.redacted).not.toContain('sk-abcdefghijklmnopqrstuvwxyz1234567890');
      expect(result.redacted).toContain('[REDACTED: API_KEY]');
      expect(result.matchedPatterns).toContain('api-key-openai');
    });

    it('should redact bearer tokens', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('Authorization: Bearer abc123def456ghij7890klmnopqrst12');

      expect(result.redacted).not.toContain('abc123def456ghij7890klmnopqrst12');
      expect(result.redacted).toContain('[REDACTED: TOKEN]');
      expect(result.matchedPatterns).toContain('bearer-token');
    });

    it('should redact password in URL parameters', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('https://example.com?user=test&password=secret123');

      expect(result.redacted).toContain('password=[REDACTED]');
      expect(result.redacted).not.toContain('password=secret123');
    });

    it('should redact passwords in command flags', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('mysql --password=mypass123');

      expect(result.redacted).toContain('--password [REDACTED]');
      expect(result.redacted).not.toContain('--password=mypass123');
    });

    it('should redact SSH private keys', () => {
      const engine = new RedactionEngine();
      const input = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAzRk9k12k123...
-----END RSA PRIVATE KEY-----`;
      const result = engine.redact(input);

      expect(result.redacted).toContain('-----REDACTED SSH PRIVATE KEY-----');
      expect(result.redacted).not.toContain('MIIEpAIBAAKCAQEAzRk9k12k123');
      expect(result.matchedPatterns).toContain('ssh-key');
    });

    it('should redact JWT tokens', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc123.def456.ghi789');

      expect(result.redacted).toContain('[REDACTED: JWT]');
      expect(result.redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(result.matchedPatterns).toContain('jwt-token');
    });

    it('should redact PII patterns in context', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('You said: my name is John Doe');

      expect(result.redacted).toContain('[REDACTED: PII]');
      expect(result.redacted).not.toContain('my name is John Doe');
      expect(result.matchedPatterns).toContain('personal-name');
    });

    it('should count multiple redactions', () => {
      const engine = new RedactionEngine();
      const input = 'Key1: sk-ant-api1234567890abcdefghe Key2: sk-ant-xyz9876543210efghijklmn';
      const result = engine.redact(input);

      expect(result.redactionCount).toBe(2);
    });
  });

  describe('PII redaction', () => {
    it('should start with PII redaction disabled', () => {
      const engine = new RedactionEngine();
      expect(engine.piiEnabled).toBe(false);
    });

    it('should enable PII redaction when requested', () => {
      const engine = new RedactionEngine();
      engine.enablePIIRedaction();

      expect(engine.piiEnabled).toBe(true);

      const result = engine.redact('Email: test@example.com IP: 192.168.1.1');
      expect(result.redacted).toContain('[REDACTED: EMAIL]');
      expect(result.redacted).toContain('[REDACTED: IPV4]');
    });

    it('should disable PII redaction when requested', () => {
      const engine = new RedactionEngine();
      engine.enablePIIRedaction();
      engine.disablePIIRedaction();

      expect(engine.piiEnabled).toBe(false);
    });
  });

  describe('Content type handling', () => {
    it('should handle text content type', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('https://example.com?password=secret', 'text');

      expect(result.redacted).toContain('password=[REDACTED]');
    });

    it('should handle JSON content type', () => {
      const engine = new RedactionEngine();
      const input = JSON.stringify({ apiKey: 'sk-ant-api1234567890abcdefghijklmnop' });
      const result = engine.redact(input, 'json');

      expect(result.redacted).toContain('[REDACTED: API_KEY]');
      expect(result.redacted).not.toContain('sk-ant-api1234567890abcdefghijklmnop');
    });

    it('should preserve JSON structure when redacting', () => {
      const engine = new RedactionEngine();
      const input = JSON.stringify({ apiKey: 'sk-ant-api1234567890abcdefghijklmnop', name: 'test' });
      const parsed = JSON.parse(engine.redact(input, 'json').redacted);

      expect(parsed.apiKey).toBe('[REDACTED: API_KEY]');
      expect(parsed.name).toBe('test');
    });

    it('should handle URL content type', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('https://example.com?password=secret', 'url');

      expect(result.redacted).toContain('password=[REDACTED]');
    });

    it('should handle header content type', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('Authorization: Bearer abc123def456ghij7890klmnopqrst12', 'header');

      expect(result.redacted).toContain('[REDACTED]');
    });

    it('should handle code content type', () => {
      const engine = new RedactionEngine();
      const input = `const apiKey = 'sk-ant-api1234567890abcdefghijklmnopqrstuvwxyz'; console.log('hello');`;
      const result = engine.redact(input, 'code');

      expect(result.redacted).toContain('[REDACTED]');
      expect(result.redacted).toContain("console.log('hello')");
    });
  });

  describe('Custom rules', () => {
    it('should add custom redaction rules', () => {
      const engine = new RedactionEngine();
      engine.addCustomRule({
        id: 'custom-secret',
        description: 'Redact custom secret',
        pattern: /CUSTOM_SECRET=[^\s]+/g,
        replacement: 'SECRET_TOKEN',
        priority: 50,
        enabled: true,
      });

      const result = engine.redact('token: CUSTOM_SECRET=abc123');
      expect(result.redacted).toContain('SECRET_TOKEN');
      expect(result.matchedPatterns).toContain('custom-secret');
    });

    it('should remove custom redaction rules', () => {
      const engine = new RedactionEngine();
      engine.addCustomRule({
        id: 'custom-secret',
        description: 'Redact custom secret',
        pattern: /CUSTOM_SECRET=[^\s]+/g,
        replacement: 'SECRET_TOKEN',
        priority: 50,
        enabled: true,
      });

      engine.removeCustomRule('custom-secret');
      const result = engine.redact('token: CUSTOM_SECRET=abc123');

      expect(result.redacted).toContain('CUSTOM_SECRET=abc123');
      expect(result.matchedPatterns).not.toContain('custom-secret');
    });

    it('should apply rules in priority order', () => {
      const engine = new RedactionEngine();
      engine.addCustomRule({
        id: 'high-priority',
        description: 'High priority rule',
        pattern: /secret/gi,
        replacement: '[HIGH]',
        priority: 200,
        enabled: true,
      });

      const result = engine.redact('This is SECRET content');
      expect(result.redacted).toContain('[HIGH]');
    });
  });

  describe('Rule management', () => {
    it('should enable and disable rules', () => {
      const engine = new RedactionEngine();
      engine.enableRule('api-key-openai', false);

      const result = engine.redact('Key: sk-abcdefghijklmnopqrstuvwxyz1234567890');
      expect(result.redacted).toContain('sk-abcdefghijklmnopqrstuvwxyz1234567890');
      expect(result.matchedPatterns).not.toContain('api-key-openai');
    });

    it('should get configured rules', () => {
      const engine = new RedactionEngine();
      const rules = engine.getRules();

      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.id === 'api-key-anthropic')).toBe(true);
    });
  });

  describe('Utility functions', () => {
    it('should redact sensitive content using utility function', () => {
      const redacted = redactSensitiveContent('https://example.com?password=secret123');

      expect(redacted).toContain('password=[REDACTED]');
      expect(redacted).not.toContain('secret123');
    });

    it('should return full result using utility function', () => {
      const result = redactWithResult('https://example.com?password=secret123');

      expect(result.redacted).toContain('password=[REDACTED]');
      expect(result.original).toBe('https://example.com?password=secret123');
      expect(result.redactionCount).toBeGreaterThan(0);
      expect(result.matchedPatterns).toEqual(expect.arrayContaining(['password-param']));
    });
  });

  describe('Edge cases', () => {
    it('should handle empty strings', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('');

      expect(result.redacted).toBe('');
      expect(result.redactionCount).toBe(0);
      expect(result.matchedPatterns).toEqual([]);
    });

    it('should handle strings with no secrets', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('This is just plain text');

      expect(result.redacted).toBe('This is just plain text');
      expect(result.redactionCount).toBe(0);
    });

    it('should handle invalid JSON gracefully', () => {
      const engine = new RedactionEngine();
      const result = engine.redact('not valid json', 'json');

      expect(result.redacted).toBe('not valid json');
    });

    it('should apply content-type specific rules only once', () => {
      const engine = new RedactionEngine();
      const input = 'https://example.com?password=secret';
      const result = engine.redact(input, 'text');

      expect(result.redacted).toContain('password=[REDACTED]');

      const result2 = engine.redact(input, 'url');
      expect(result2.redacted).toContain('password=[REDACTED]');
    });
  });

  describe('Determinism', () => {
    it('should produce same output for same input', () => {
      const engine1 = new RedactionEngine();
      const engine2 = new RedactionEngine();

      const input = 'https://example.com?password=secret123 sk-ant-api1234567890abcd';
      const result1 = engine1.redact(input, 'text');
      const result2 = engine2.redact(input, 'text');

      expect(result1.redacted).toBe(result2.redacted);
      expect(result1.matchedPatterns).toEqual(result2.matchedPatterns);
    });

    it('should produce consistent results across multiple calls', () => {
      const engine = new RedactionEngine();
      const input = 'https://example.com?password=secret123';

      const result1 = engine.redact(input);
      const result2 = engine.redact(input);

      expect(result1.redacted).toBe(result2.redacted);
    });
  });
});
