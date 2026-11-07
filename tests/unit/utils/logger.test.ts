/**
 * tests/unit/utils/logger.test.ts
 *
 * Logger Unit Tests
 *
 * Tests core logger with redaction support, no VS Code API imports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Logger, LogLevel, LogEntry } from '../../../src/utils/logger.js';

describe('Logger', () => {
  let logger: Logger;
  let capturedLogs: LogEntry[];

  beforeEach(() => {
    capturedLogs = [];
    // Capture logs in memory for testing
    logger = new Logger({
      level: LogLevel.DEBUG,
      // Custom output function that captures to memory
      output: (entry: LogEntry) => {
        capturedLogs.push(entry);
      },
    });
  });

  afterEach(() => {
    logger.dispose();
  });

  describe('Log Level Filtering', () => {
    it('should log all messages at DEBUG level', () => {
      const debugLogger = new Logger({
        level: LogLevel.DEBUG,
        output: (e) => capturedLogs.push(e),
      });

      debugLogger.debug('debug message');
      debugLogger.info('info message');
      debugLogger.warn('warning message');
      debugLogger.error('error message');

      expect(capturedLogs).toHaveLength(4);

      debugLogger.dispose();
    });

    it('should filter DEBUG messages at INFO level', () => {
      const infoLogger = new Logger({
        level: LogLevel.INFO,
        output: (e) => capturedLogs.push(e),
      });

      infoLogger.debug('debug message');
      infoLogger.info('info message');
      infoLogger.warn('warning message');
      infoLogger.error('error message');

      expect(capturedLogs).toHaveLength(3);
      expect(capturedLogs.find((l) => l.message === 'debug message')).toBeUndefined();

      infoLogger.dispose();
    });

    it('should filter DEBUG and INFO messages at WARN level', () => {
      const warnLogger = new Logger({
        level: LogLevel.WARN,
        output: (e) => capturedLogs.push(e),
      });

      warnLogger.debug('debug message');
      warnLogger.info('info message');
      warnLogger.warn('warning message');
      warnLogger.error('error message');

      expect(capturedLogs).toHaveLength(2);
      expect(capturedLogs.find((l) => l.message === 'warning message')).toBeDefined();

      warnLogger.dispose();
    });

    it('should only log ERROR messages at ERROR level', () => {
      const errorLogger = new Logger({
        level: LogLevel.ERROR,
        output: (e) => capturedLogs.push(e),
      });

      errorLogger.debug('debug message');
      errorLogger.info('info message');
      errorLogger.warn('warning message');
      errorLogger.error('error message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].level).toBe(LogLevel.ERROR);

      errorLogger.dispose();
    });
  });

  describe('Log Entry Structure', () => {
    it('should include timestamp in log entry', () => {
      logger.info('test message');

      expect(capturedLogs).toHaveLength(1);
      expect(capturedLogs[0].timestamp).toBeInstanceOf(Date);
    });

    it('should include log level in entry', () => {
      logger.info('test message');

      expect(capturedLogs[0].level).toBe(LogLevel.INFO);
    });

    it('should include message in entry', () => {
      logger.info('test message');

      expect(capturedLogs[0].message).toBe('test message');
    });

    it('should include context data when provided', () => {
      logger.info('test message', { key: 'value', number: 42 });

      expect(capturedLogs[0].context).toEqual({ key: 'value', number: 42 });
    });

    it('should handle undefined context', () => {
      logger.info('test message', undefined);

      expect(capturedLogs[0].context).toBeUndefined();
    });
  });

  describe('Secret Redaction', () => {
    it('should redact common secret keywords in messages', () => {
      logger.info('auth token: sk-ant-api03-12345');

      expect(capturedLogs[0].message).toContain('[REDACTED]');
      expect(capturedLogs[0].message).not.toContain('sk-ant-api03-12345');
    });

    it('should redact secret keywords in context', () => {
      logger.info('message', {
        authToken: 'sk-ant-api03-12345',
        apiKey: 'secret-key',
        normalData: 'public',
      });

      expect(capturedLogs[0].context?.authToken).toBe('[REDACTED]');
      expect(capturedLogs[0].context?.apiKey).toBe('[REDACTED]');
      expect(capturedLogs[0].context?.normalData).toBe('public');
    });

    it('should redact nested objects in context', () => {
      logger.info('message', {
        config: {
          authToken: 'secret',
          url: 'https://api.example.com',
        },
      });

      expect(capturedLogs[0].context?.config?.authToken).toBe('[REDACTED]');
      expect(capturedLogs[0].context?.config?.url).toBe('https://api.example.com');
    });

    it('should redact arrays containing secrets', () => {
      logger.info('message', {
        tokens: ['token1', 'secret-token', 'token3'],
      });

      expect(capturedLogs[0].context?.tokens).toEqual(['token1', '[REDACTED]', 'token3']);
    });
  });

  describe('Message Formatting', () => {
    it('should format messages with placeholders', () => {
      logger.info('User {userId} logged in from {ip}', { userId: '123', ip: '192.168.1.1' });

      expect(capturedLogs[0].message).toBe('User 123 logged in from 192.168.1.1');
    });

    it('should handle missing placeholders gracefully', () => {
      logger.info('User {userId} logged in from {ip}', { userId: '123' });

      expect(capturedLogs[0].message).toBe('User 123 logged in from {ip}');
    });

    it('should preserve message when no context provided', () => {
      logger.info('Simple message');

      expect(capturedLogs[0].message).toBe('Simple message');
    });
  });

  describe('Error Logging', () => {
    it('should include error object in context', () => {
      const err = new Error('Test error');
      logger.error('Operation failed', { error: err });

      expect(capturedLogs[0].context?.error).toBeDefined();
      expect(capturedLogs[0].context?.error).toBeInstanceOf(Error);
      expect(capturedLogs[0].context?.error?.message).toBe('Test error');
    });

    it('should redact stack traces if they contain secrets', () => {
      const err = new Error('Error with secret: sk-ant-api03-12345');
      logger.error('Operation failed', { error: err });

      expect(capturedLogs[0].context?.error?.stack).not.toContain('sk-ant-api03-12345');
    });

    it('should handle null context with error', () => {
      logger.error('Operation failed');

      expect(capturedLogs[0].context).toBeUndefined();
    });
  });

  describe('Custom Redaction Patterns', () => {
    it('should use custom redaction patterns', () => {
      const customLogger = new Logger({
        level: LogLevel.INFO,
        output: (e) => capturedLogs.push(e),
        redaction: {
          patterns: ['custom_secret', 'sensitive_data'],
        },
      });

      customLogger.info('message', {
        custom_secret: 'value',
        sensitive_data: 'value2',
        normal: 'value3',
      });

      expect(capturedLogs[0].context?.custom_secret).toBe('[REDACTED]');
      expect(capturedLogs[0].context?.sensitive_data).toBe('[REDACTED]');
      expect(capturedLogs[0].context?.normal).toBe('value3');

      customLogger.dispose();
    });
  });

  describe('Disposal', () => {
    it('should clear listeners on dispose', () => {
      logger.dispose();

      // Should not throw
      logger.info('test message');

      // Logs should be captured because we're using custom output function, not listeners
      expect(capturedLogs).toHaveLength(1);
    });

    it('should handle multiple disposals', () => {
      logger.dispose();

      expect(() => logger.dispose()).not.toThrow();
    });
  });
});
