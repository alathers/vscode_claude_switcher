/**
 * tests/unit/utils/url-validator.test.ts
 *
 * URL Validator Unit Tests
 *
 * Tests URL validation and normalization (no VS Code API imports).
 */

import { describe, it, expect } from 'vitest';
import { URLValidator, ValidationError } from '../../../src/utils/url-validator.js';

describe('URLValidator', () => {
  const validator = new URLValidator();

  describe('Validation', () => {
    it('should validate HTTPS URLs', () => {
      expect(validator.isValid('https://api.example.com')).toBe(true);
      expect(validator.isValid('https://api.anthropic.com')).toBe(true);
    });

    it('should validate HTTP URLs', () => {
      expect(validator.isValid('http://localhost:11434')).toBe(true);
      expect(validator.isValid('http://127.0.0.1:8080')).toBe(true);
    });

    it('should reject FTP URLs', () => {
      expect(validator.isValid('ftp://example.com')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(validator.isValid('not-a-url')).toBe(false);
      expect(validator.isValid('')).toBe(false);
      expect(validator.isValid('just-text')).toBe(false);
    });

    it('should reject URLs without hostname', () => {
      expect(validator.isValid('https://')).toBe(false);
      expect(validator.isValid('http://')).toBe(false);
    });

    it('should reject non-HTTP protocols', () => {
      expect(validator.isValid('file:///path/to/file')).toBe(false);
      expect(validator.isValid('mailto:test@example.com')).toBe(false);
    });
  });

  describe('Normalization', () => {
    it('should normalize HTTPS URL without changes', () => {
      const result = validator.normalize('https://api.example.com');
      expect(result).toBe('https://api.example.com');
    });

    it('should normalize HTTP URL without changes', () => {
      const result = validator.normalize('http://localhost:11434');
      expect(result).toBe('http://localhost:11434');
    });

    it('should add default port 443 for HTTPS when addDefaultPorts is true', () => {
      const result = validator.normalize('https://api.anthropic.com', { addDefaultPorts: true });
      expect(result).toBe('https://api.anthropic.com:443');
    });

    it('should add default port 80 for HTTP when addDefaultPorts is true', () => {
      const result = validator.normalize('http://localhost', { addDefaultPorts: true });
      expect(result).toBe('http://localhost:80');
    });

    it('should preserve existing ports when addDefaultPorts is true', () => {
      const result = validator.normalize('https://api.example.com:8443', { addDefaultPorts: true });
      expect(result).toBe('https://api.example.com:8443');
    });

    it('should not add default ports when addDefaultPorts is false', () => {
      const result = validator.normalize('https://api.example.com', { addDefaultPorts: false });
      expect(result).toBe('https://api.example.com');
    });

    it('should throw ValidationError for invalid URLs', () => {
      expect(() => {
        validator.normalize('not-a-url');
      }).toThrow(ValidationError);

      expect(() => {
        validator.normalize('ftp://example.com');
      }).toThrow(ValidationError);
    });
  });

  describe('Localhost Detection', () => {
    it('should detect localhost URLs', () => {
      expect(validator.isLocalhost('http://localhost:11434')).toBe(true);
      expect(validator.isLocalhost('https://localhost:8443')).toBe(true);
    });

    it('should detect 127.0.0.1 URLs', () => {
      expect(validator.isLocalhost('http://127.0.0.1:11434')).toBe(true);
      expect(validator.isLocalhost('https://127.0.0.1:8443')).toBe(true);
    });

    it('should detect ::1 (IPv6 localhost)', () => {
      expect(validator.isLocalhost('http://[::1]:11434')).toBe(true);
    });

    it('should detect 127.x.x.x URLs', () => {
      expect(validator.isLocalhost('http://127.0.0.2:11434')).toBe(true);
      expect(validator.isLocalhost('http://127.1.1.1:8080')).toBe(true);
    });

    it('should reject non-localhost URLs', () => {
      expect(validator.isLocalhost('https://api.anthropic.com')).toBe(false);
      expect(validator.isLocalhost('http://192.168.1.1:8080')).toBe(false);
      expect(validator.isLocalhost('https://google.com')).toBe(false);
    });
  });

  describe('Port Extraction', () => {
    it('should extract explicit port from URL', () => {
      expect(validator.getPort('https://api.example.com:8443')).toBe(8443);
      expect(validator.getPort('http://localhost:11434')).toBe(11434);
    });

    it('should return default port for HTTPS when no port specified', () => {
      expect(validator.getPort('https://api.example.com')).toBe(443);
    });

    it('should return default port for HTTP when no port specified', () => {
      expect(validator.getPort('http://localhost', 80)).toBe(80);
    });

    it('should return undefined for invalid URLs', () => {
      expect(validator.getPort('not-a-url')).toBeUndefined();
    });
  });

  describe('Auth Detection', () => {
    it('should detect username in URL', () => {
      expect(validator.hasAuth('https://user@api.example.com')).toBe(true);
    });

    it('should detect password in URL', () => {
      expect(validator.hasAuth('https://user:pass@api.example.com')).toBe(true);
    });

    it('should detect password without username in URL', () => {
      expect(validator.hasAuth('https://:pass@api.example.com')).toBe(true);
    });

    it('should return false for URLs without auth', () => {
      expect(validator.hasAuth('https://api.example.com')).toBe(false);
      expect(validator.hasAuth('http://localhost:11434')).toBe(false);
    });
  });
});
