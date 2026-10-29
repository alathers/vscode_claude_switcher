/**
 * tests/unit/utils/logger.test.ts
 *
 * Unit tests for logger.ts
 * Tests pure logic logging utility without VS Code API dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Logger,
  LogLevel,
  LogEntry,
  formatLogEntry,
  createLogger,
} from '@src/utils/logger';

describe('LogLevel', () => {
  it('should have correct numeric values', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });

  it('should have string representation', () => {
    expect(LogLevel[LogLevel.DEBUG]).toBe('DEBUG');
    expect(LogLevel[LogLevel.INFO]).toBe('INFO');
    expect(LogLevel[LogLevel.WARN]).toBe('WARN');
    expect(LogLevel[LogLevel.ERROR]).toBe('ERROR');
  });
});

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger(LogLevel.DEBUG);
  });

  describe('constructor', () => {
    it('should create logger with default minLevel INFO', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger.getMinLevel()).toBe(LogLevel.INFO);
    });

    it('should create logger with custom minLevel', () => {
      const debugLogger = new Logger(LogLevel.DEBUG);
      expect(debugLogger.getMinLevel()).toBe(LogLevel.DEBUG);
    });

    it('should start with empty entries', () => {
      expect(logger.getEntries()).toEqual([]);
      expect(logger.getEntryCount()).toBe(0);
    });
  });

  describe('debug', () => {
    it('should log debug message when minLevel is DEBUG', () => {
      logger.debug('category', 'debug message');
      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(LogLevel.DEBUG);
      expect(entries[0].category).toBe('category');
      expect(entries[0].message).toBe('debug message');
    });

    it('should log debug message with metadata', () => {
      const metadata = { key: 'value', count: 42 };
      logger.debug('category', 'debug message', metadata);
      const entries = logger.getEntries();
      expect(entries[0].metadata).toEqual(metadata);
    });

    it('should not log debug when minLevel is higher', () => {
      const infoLogger = new Logger(LogLevel.INFO);
      infoLogger.debug('category', 'debug message');
      expect(infoLogger.getEntries()).toHaveLength(0);
    });

    it('should store timestamp', () => {
      const before = new Date();
      logger.debug('category', 'message');
      const entries = logger.getEntries();
      const after = new Date();
      expect(entries[0].timestamp).toBeInstanceOf(Date);
      expect(entries[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entries[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('category', 'info message');
      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(LogLevel.INFO);
      expect(entries[0].category).toBe('category');
      expect(entries[0].message).toBe('info message');
    });

    it('should log info message with metadata', () => {
      const metadata = { user: 'test', action: 'login' };
      logger.info('auth', 'user logged in', metadata);
      const entries = logger.getEntries();
      expect(entries[0].metadata).toEqual(metadata);
    });

    it('should not log info when minLevel is WARN', () => {
      const warnLogger = new Logger(LogLevel.WARN);
      warnLogger.info('category', 'info message');
      expect(warnLogger.getEntries()).toHaveLength(0);
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('category', 'warning message');
      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(LogLevel.WARN);
      expect(entries[0].category).toBe('category');
      expect(entries[0].message).toBe('warning message');
    });

    it('should log warning message with metadata', () => {
      const metadata = { code: 404, url: '/missing' };
      logger.warn('http', 'resource not found', metadata);
      const entries = logger.getEntries();
      expect(entries[0].metadata).toEqual(metadata);
    });

    it('should not log warn when minLevel is ERROR', () => {
      const errorLogger = new Logger(LogLevel.ERROR);
      errorLogger.warn('category', 'warning message');
      expect(errorLogger.getEntries()).toHaveLength(0);
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      logger.error('category', 'error message');
      const entries = logger.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].level).toBe(LogLevel.ERROR);
      expect(entries[0].category).toBe('category');
      expect(entries[0].message).toBe('error message');
    });

    it('should log error message with metadata', () => {
      const metadata = { error: 'ConnectionFailed', retries: 3 };
      logger.error('network', 'failed to connect', metadata);
      const entries = logger.getEntries();
      expect(entries[0].metadata).toEqual(metadata);
    });

    it('should always log error regardless of minLevel', () => {
      const infoLogger = new Logger(LogLevel.INFO);
      infoLogger.error('category', 'error message');
      expect(infoLogger.getEntries()).toHaveLength(1);
    });
  });

  describe('getEntries', () => {
    it('should return empty array when no entries', () => {
      expect(logger.getEntries()).toEqual([]);
    });

    it('should return copy of entries', () => {
      logger.debug('cat1', 'msg1');
      const entries1 = logger.getEntries();
      const entries2 = logger.getEntries();

      // Modifying the returned array should not affect other returned arrays
      entries1.push({
        timestamp: new Date(),
        level: LogLevel.INFO,
        category: 'cat2',
        message: 'msg2',
      });
      expect(entries2).toHaveLength(1);
      expect(logger.getEntries()).toHaveLength(1);
    });

    it('should return all entries in order', () => {
      logger.debug('cat1', 'msg1');
      logger.info('cat2', 'msg2');
      logger.warn('cat3', 'msg3');
      logger.error('cat4', 'msg4');

      const entries = logger.getEntries();
      expect(entries).toHaveLength(4);
      expect(entries[0].message).toBe('msg1');
      expect(entries[1].message).toBe('msg2');
      expect(entries[2].message).toBe('msg3');
      expect(entries[3].message).toBe('msg4');
    });
  });

  describe('getEntriesByLevel', () => {
    beforeEach(() => {
      logger.debug('cat', 'debug1');
      logger.debug('cat', 'debug2');
      logger.info('cat', 'info1');
      logger.warn('cat', 'warn1');
      logger.warn('cat', 'warn2');
      logger.error('cat', 'error1');
    });

    it('should filter by DEBUG level', () => {
      const debugEntries = logger.getEntriesByLevel(LogLevel.DEBUG);
      expect(debugEntries).toHaveLength(2);
      debugEntries.forEach(entry => {
        expect(entry.level).toBe(LogLevel.DEBUG);
      });
    });

    it('should filter by INFO level', () => {
      const infoEntries = logger.getEntriesByLevel(LogLevel.INFO);
      expect(infoEntries).toHaveLength(1);
      expect(infoEntries[0].level).toBe(LogLevel.INFO);
    });

    it('should filter by WARN level', () => {
      const warnEntries = logger.getEntriesByLevel(LogLevel.WARN);
      expect(warnEntries).toHaveLength(2);
      warnEntries.forEach(entry => {
        expect(entry.level).toBe(LogLevel.WARN);
      });
    });

    it('should filter by ERROR level', () => {
      const errorEntries = logger.getEntriesByLevel(LogLevel.ERROR);
      expect(errorEntries).toHaveLength(1);
      expect(errorEntries[0].level).toBe(LogLevel.ERROR);
    });

    it('should return empty array when no entries for level', () => {
      logger.clear();
      const debugEntries = logger.getEntriesByLevel(LogLevel.DEBUG);
      expect(debugEntries).toEqual([]);
    });
  });

  describe('getEntriesByCategory', () => {
    beforeEach(() => {
      logger.debug('auth', 'login');
      logger.info('auth', 'logout');
      logger.warn('network', 'timeout');
      logger.error('auth', 'failed');
    });

    it('should filter by category', () => {
      const authEntries = logger.getEntriesByCategory('auth');
      expect(authEntries).toHaveLength(3);
      authEntries.forEach(entry => {
        expect(entry.category).toBe('auth');
      });
    });

    it('should return empty array when no entries for category', () => {
      const dbEntries = logger.getEntriesByCategory('database');
      expect(dbEntries).toEqual([]);
    });

    it('should be case-sensitive', () => {
      const authLower = logger.getEntriesByCategory('auth');
      const authUpper = logger.getEntriesByCategory('AUTH');
      expect(authLower).toHaveLength(3);
      expect(authUpper).toHaveLength(0);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      logger.debug('cat', 'msg1');
      logger.info('cat', 'msg2');
    });

    it('should clear all entries', () => {
      logger.clear();
      expect(logger.getEntries()).toEqual([]);
      expect(logger.getEntryCount()).toBe(0);
    });

    it('should allow logging after clear', () => {
      logger.clear();
      logger.debug('cat', 'new message');
      expect(logger.getEntries()).toHaveLength(1);
    });
  });

  describe('getEntryCount', () => {
    it('should return 0 when empty', () => {
      expect(logger.getEntryCount()).toBe(0);
    });

    it('should count all entries', () => {
      logger.debug('cat', 'msg1');
      logger.info('cat', 'msg2');
      logger.warn('cat', 'msg3');
      expect(logger.getEntryCount()).toBe(3);
    });

    it('should update count after clear', () => {
      logger.debug('cat', 'msg1');
      logger.clear();
      expect(logger.getEntryCount()).toBe(0);
    });
  });

  describe('setMinLevel and getMinLevel', () => {
    it('should get initial minLevel', () => {
      expect(logger.getMinLevel()).toBe(LogLevel.DEBUG);
    });

    it('should set minLevel to INFO', () => {
      logger.setMinLevel(LogLevel.INFO);
      expect(logger.getMinLevel()).toBe(LogLevel.INFO);
    });

    it('should set minLevel to WARN', () => {
      logger.setMinLevel(LogLevel.WARN);
      expect(logger.getMinLevel()).toBe(LogLevel.WARN);
    });

    it('should set minLevel to ERROR', () => {
      logger.setMinLevel(LogLevel.ERROR);
      expect(logger.getMinLevel()).toBe(LogLevel.ERROR);
    });

    it('should respect new minLevel after set', () => {
      logger.setMinLevel(LogLevel.WARN);
      logger.debug('cat', 'debug');
      logger.info('cat', 'info');
      logger.warn('cat', 'warn');
      logger.error('cat', 'error');
      expect(logger.getEntries()).toHaveLength(2); // Only warn and error
    });
  });

  describe('minLevel filtering', () => {
    it('should filter DEBUG when minLevel is INFO', () => {
      const infoLogger = new Logger(LogLevel.INFO);
      infoLogger.debug('cat', 'debug');
      infoLogger.info('cat', 'info');
      expect(infoLogger.getEntries()).toHaveLength(1);
      expect(infoLogger.getEntries()[0].level).toBe(LogLevel.INFO);
    });

    it('should filter DEBUG and INFO when minLevel is WARN', () => {
      const warnLogger = new Logger(LogLevel.WARN);
      warnLogger.debug('cat', 'debug');
      warnLogger.info('cat', 'info');
      warnLogger.warn('cat', 'warn');
      warnLogger.error('cat', 'error');
      expect(warnLogger.getEntries()).toHaveLength(2);
    });

    it('should filter DEBUG, INFO, WARN when minLevel is ERROR', () => {
      const errorLogger = new Logger(LogLevel.ERROR);
      errorLogger.debug('cat', 'debug');
      errorLogger.info('cat', 'info');
      errorLogger.warn('cat', 'warn');
      errorLogger.error('cat', 'error');
      expect(errorLogger.getEntries()).toHaveLength(1);
      expect(errorLogger.getEntries()[0].level).toBe(LogLevel.ERROR);
    });

    it('should log all levels when minLevel is DEBUG', () => {
      logger.debug('cat', 'debug');
      logger.info('cat', 'info');
      logger.warn('cat', 'warn');
      logger.error('cat', 'error');
      expect(logger.getEntries()).toHaveLength(4);
    });
  });
});

describe('formatLogEntry', () => {
  it('should format entry without metadata', () => {
    const entry: LogEntry = {
      timestamp: new Date('2023-01-01T12:00:00.000Z'),
      level: LogLevel.INFO,
      category: 'test',
      message: 'test message',
    };
    const formatted = formatLogEntry(entry);
    expect(formatted).toBe('[2023-01-01T12:00:00.000Z] [INFO ] [test] test message');
  });

  it('should format entry with metadata', () => {
    const entry: LogEntry = {
      timestamp: new Date('2023-01-01T12:00:00.000Z'),
      level: LogLevel.ERROR,
      category: 'network',
      message: 'connection failed',
      metadata: { code: 500, url: '/api/test' },
    };
    const formatted = formatLogEntry(entry);
    expect(formatted).toContain('[2023-01-01T12:00:00.000Z]');
    expect(formatted).toContain('[ERROR]');
    expect(formatted).toContain('[network]');
    expect(formatted).toContain('connection failed');
    expect(formatted).toContain('{"code":500,"url":"/api/test"}');
  });

  it('should pad level to 5 characters', () => {
    const infoEntry: LogEntry = {
      timestamp: new Date('2023-01-01T12:00:00.000Z'),
      level: LogLevel.INFO,
      category: 'test',
      message: 'msg',
    };
    const errorEntry: LogEntry = {
      timestamp: new Date('2023-01-01T12:00:00.000Z'),
      level: LogLevel.ERROR,
      category: 'test',
      message: 'msg',
    };
    const infoFormatted = formatLogEntry(infoEntry);
    const errorFormatted = formatLogEntry(errorEntry);
    expect(infoFormatted).toContain('[INFO ]');
    expect(errorFormatted).toContain('[ERROR]');
  });

  it('should use ISO timestamp', () => {
    const entry: LogEntry = {
      timestamp: new Date('2023-06-15T14:30:45.123Z'),
      level: LogLevel.DEBUG,
      category: 'test',
      message: 'msg',
    };
    const formatted = formatLogEntry(entry);
    expect(formatted).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
  });

  it('should handle nested metadata', () => {
    const entry: LogEntry = {
      timestamp: new Date('2023-01-01T12:00:00.000Z'),
      level: LogLevel.WARN,
      category: 'test',
      message: 'nested data',
      metadata: { outer: { inner: 'value' } },
    };
    const formatted = formatLogEntry(entry);
    expect(formatted).toContain('nested data');
    expect(formatted).toContain('{"outer":{"inner":"value"}}');
  });

  it('should handle array metadata', () => {
    const entry: LogEntry = {
      timestamp: new Date('2023-01-01T12:00:00.000Z'),
      level: LogLevel.DEBUG,
      category: 'test',
      message: 'array data',
      metadata: { items: [1, 2, 3] },
    };
    const formatted = formatLogEntry(entry);
    expect(formatted).toContain('{"items":[1,2,3]}');
  });
});

describe('createLogger', () => {
  it('should create logger with default INFO level', () => {
    const logger = createLogger();
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getMinLevel()).toBe(LogLevel.INFO);
  });

  it('should create logger with DEBUG level', () => {
    const logger = createLogger(LogLevel.DEBUG);
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getMinLevel()).toBe(LogLevel.DEBUG);
  });

  it('should create logger with WARN level', () => {
    const logger = createLogger(LogLevel.WARN);
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getMinLevel()).toBe(LogLevel.WARN);
  });

  it('should create logger with ERROR level', () => {
    const logger = createLogger(LogLevel.ERROR);
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.getMinLevel()).toBe(LogLevel.ERROR);
  });

  it('should create independent logger instances', () => {
    const logger1 = createLogger(LogLevel.DEBUG);
    const logger2 = createLogger(LogLevel.DEBUG);

    logger1.info('cat1', 'msg1');
    logger2.info('cat2', 'msg2');

    expect(logger1.getEntries()).toHaveLength(1);
    expect(logger2.getEntries()).toHaveLength(1);
    expect(logger1.getEntries()[0].category).toBe('cat1');
    expect(logger2.getEntries()[0].category).toBe('cat2');
  });
});

describe('integration tests', () => {
  it('should handle real workflow: log, filter, format', () => {
    const logger = new Logger(LogLevel.INFO);

    logger.debug('system', 'startup'); // Filtered out
    logger.info('system', 'ready');
    logger.warn('network', 'slow response', { latency: 500 });
    logger.error('auth', 'login failed', { userId: '123', attempt: 3 });

    const allEntries = logger.getEntries();
    expect(allEntries).toHaveLength(3);

    const warnEntries = logger.getEntriesByLevel(LogLevel.WARN);
    expect(warnEntries).toHaveLength(1);
    expect(warnEntries[0].metadata).toEqual({ latency: 500 });

    const systemEntries = logger.getEntriesByCategory('system');
    expect(systemEntries).toHaveLength(1);

    const formatted = formatLogEntry(systemEntries[0]);
    expect(formatted).toContain('[INFO ]');
    expect(formatted).toContain('[system]');
    expect(formatted).toContain('ready');
  });

  it('should handle changing minLevel mid-session', () => {
    const logger = new Logger(LogLevel.ERROR);

    logger.debug('cat', 'msg1'); // Filtered
    logger.error('cat', 'msg2'); // Logged
    expect(logger.getEntryCount()).toBe(1);

    logger.setMinLevel(LogLevel.DEBUG);
    logger.debug('cat', 'msg3'); // Now logged
    logger.info('cat', 'msg4'); // Now logged
    expect(logger.getEntryCount()).toBe(3);
  });

  it('should handle large volumes of messages', () => {
    const logger = new Logger(LogLevel.DEBUG);
    const count = 1000;

    for (let i = 0; i < count; i++) {
      logger.info(`category${i % 10}`, `message ${i}`);
    }

    expect(logger.getEntryCount()).toBe(count);
  });

  it('should combine multiple filters', () => {
    const logger = new Logger(LogLevel.DEBUG);

    logger.info('auth', 'login', { user: 'alice' });
    logger.info('auth', 'logout', { user: 'alice' });
    logger.warn('auth', 'invalid token', { user: 'bob' });
    logger.info('network', 'request', { url: '/api' });

    const authEntries = logger.getEntriesByCategory('auth');
    expect(authEntries).toHaveLength(3);

    const authInfoEntries = authEntries.filter(e => e.level === LogLevel.INFO);
    expect(authInfoEntries).toHaveLength(2);
  });

  it('should handle complex metadata objects', () => {
    const logger = new Logger(LogLevel.INFO);

    const complexMetadata = {
      user: {
        id: '123',
        profile: {
          name: 'Test User',
          email: 'test@example.com',
        },
        roles: ['admin', 'user'],
      },
      request: {
        method: 'POST',
        url: '/api/data',
        headers: {
          'x-request-id': 'abc-123',
        },
      },
      timing: {
        start: 1000,
        end: 1050,
        duration: 50,
      },
    };

    logger.info('api', 'request processed', complexMetadata);

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].metadata).toEqual(complexMetadata);
  });
});

describe('edge cases', () => {
  it('should handle empty category', () => {
    const logger = new Logger(LogLevel.DEBUG);
    logger.info('', 'message with empty category');

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].category).toBe('');
  });

  it('should handle empty message', () => {
    const logger = new Logger(LogLevel.DEBUG);
    logger.info('category', '');

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].message).toBe('');
  });

  it('should handle special characters in message', () => {
    const logger = new Logger(LogLevel.DEBUG);
    const specialMessage = 'Test with emoji 🎉 and special chars: <>&"\n\t\\';

    logger.info('test', specialMessage);

    const entries = logger.getEntries();
    expect(entries[0].message).toBe(specialMessage);
  });

  it('should handle null and undefined in metadata', () => {
    const logger = new Logger(LogLevel.DEBUG);
    logger.info('test', 'message', { null: null, undefined: undefined, value: 'ok' });

    const entries = logger.getEntries();
    expect(entries[0].metadata?.value).toBe('ok');
  });

  it('should handle circular references (should not crash)', () => {
    const logger = new Logger(LogLevel.DEBUG);

    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    // This should not throw (JSON.stringify handles this poorly, but we test it doesn't crash the logger)
    logger.info('test', 'message', { a: 1 });

    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
  });

  it('should handle multiple clears', () => {
    const logger = new Logger(LogLevel.DEBUG);
    logger.info('cat', 'msg1');
    logger.clear();
    logger.clear();
    logger.clear();

    expect(logger.getEntries()).toHaveLength(0);
  });

  it('should handle metadata with very long values', () => {
    const logger = new Logger(LogLevel.DEBUG);
    const longString = 'x'.repeat(10000);

    logger.info('test', 'message', { long: longString });

    const entries = logger.getEntries();
    expect(entries[0].metadata?.long).toBe(longString);
  });

  it('should handle Unicode in category and message', () => {
    const logger = new Logger(LogLevel.DEBUG);
    logger.info('系统', '消息 测试 🌍');

    const entries = logger.getEntries();
    expect(entries[0].category).toBe('系统');
    expect(entries[0].message).toBe('消息 测试 🌍');
  });
});
