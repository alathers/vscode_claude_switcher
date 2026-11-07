/**
 * tests/unit/utils/url-validator.test.ts
 *
 * URL Validator Unit Tests
 *
 * Tests HTTP/HTTPS URL validation logic without VS Code API dependencies.
 */

import { describe, it, expect } from 'vitest';
import { URLValidator } from '../../../src/utils/url-validator.js';

describe('URLValidator', () => {
  describe('Valid HTTP URLs', () => {
    it('should accept standard HTTP URL', () => {
      const validator = new URLValidator();
      expect(validator.isValid('http://example.com')).toBe(true);
    });

    it('should accept standard HTTPS URL', () => {
      const validator = new URLValidator();
      expect(validator.isValid('https://api.anthropic.com')).toBe(true);
    });

    it('should accept HTTPS URL with path', () => {
      const validator = new URLValidator();
      expect(validator.isValid('https://api.anthropic.com/v1/messages')).toBe(true);
    });

    it('should accept HTTPS URL with port', () => {
      const validator = new URLValidator();
      expect(validator.isValid('https://api.anthropic.com:443')).toBe(true);
    });

    it('should accept HTTP with all components', () => {
      const validator = new URLValidator();
      expect(
        validator.isValid('http://localhost:11434/v1/models')
      ).toBe(true);
    });
  });

  describe('Valid SSH Tunnel URLs (localhost)', () => {
    it('should accept localhost HTTP URL', () => {
      const validator = new URLValidator();
      expect(validator.isValid('http://localhost:11434')).toBe(true);
    });

    it('should accept localhost with default port', () => {
      const validator = new URLValidator();
      expect(validator.isValid('http://localhost')).toBe(true);
    });

    it('should accept 127.0.0.1', () => {
      const validator = new URLValidator();
      expect(validator.isValid('http://127.0.0.1:11434')).toBe(true);
    });
  });

  describe('Invalid URLs', () => {
    it('should reject non-HTTP/HTTPS protocols', () => {
      const validator = new URLValidator();
      expect(validator.isValid('ftp://example.com')).toBe(false);
    });

    it('should reject ws:// protocol', () => {
      const validator = new URLValidator();
      expect(validator.isValid('ws://example.com')).toBe(false);
    });

    it('should reject gopher:// protocol', () => {
      const validator = new URLValidator();
      expect(validator.isValid('gopher://example.com')).toBe(false);
    });

    it('should reject URLs without protocol', () => {
      const validator = new URLValidator();
      expect(validator.isValid('example.com')).toBe(false);
    });

    it('should reject malformed URL structure', () => {
      const validator = new URLValidator();
      expect(validator.isValid('http:/example.com')).toBe(false);
    });

    it('should reject URL with invalid characters', () => {
      const validator = new URLValidator();
      expect(validator.isValid('http://example.com/path with spaces')).toBe(false);
    });

    it('should reject empty string', () => {
      const validator = new URLValidator();
      expect(validator.isValid('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      const validator = new URLValidator();

      expect(validator.isValid(null as unknown as string)).toBe(false);
      expect(validator.isValid(undefined as unknown as string)).toBe(false);
    });
  });

  describe('Normalize URLs', () => {
    it('should remove trailing slashes', () => {
      const validator = new URLValidator();
      expect(validator.normalize('https://api.anthropic.com/')).toBe('https://api.anthropic.com');
    });

    it('should keep path intact', () => {
      const validator = new URLValidator();
      expect(validator.normalize('https://api.anthropic.com/v1/messages')).toBe(
        'https://api.anthropic.com/v1/messages'
      );
    });

    it('should add default port for HTTPS if not specified', () => {
      const validator = new URLValidator();
      expect(validator.normalize('https://api.anthropic.com', { addDefaultPorts: true })).toBe('https://api.anthropic.com:443');
    });

    it('should add default port for HTTP if not specified', () => {
      const validator = new URLValidator();
      expect(validator.normalize('http://localhost', { addDefaultPorts: true })).toBe('http://localhost:80');
    });

    it('should preserve custom ports', () => {
      const validator = new URLValidator();
      expect(validator.normalize('http://localhost:11434')).toBe('http://localhost:11434');
    });
  });

  describe('Error Messages', () => {
    it('should provide meaningful error for invalid protocol', () => {
      const validator = new URLValidator();
      const err = validator.getError('ftp://example.com');
      expect(err).toContain('protocol');
      expect(err).toContain('http');
    });

    it('should provide meaningful error for malformed URL', () => {
      const validator = new URLValidator();
      const err = validator.getError('not a url');
      expect(err).toContain('invalid');
    });

    it('should return null for valid URL', () => {
      const validator = new URLValidator();
      expect(validator.getError('https://api.anthropic.com')).toBeNull();
    });
  });
});
