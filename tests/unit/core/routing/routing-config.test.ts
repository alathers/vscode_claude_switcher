/**
 * Unit tests for routing configuration
 *
 * Tests configuration parsing, validation, and persistence.
 */

import { describe, it, expect, vi } from 'vitest';
import { loadConfiguration, validateConfiguration } from '../../../../src/core/routing/routing-config';
import type { RoutingConfiguration } from '../../../../src/core/routing/routing-config';
import { Logger, LogLevel } from '../../../../src/utils/logger';

describe('Routing Configuration - Parsing', () => {
  it('loads default configuration when no values provided', async () => {
    const mockConfig = {
      get: vi.fn((key, defaultValue) => defaultValue)
    };

    const config = await loadConfiguration(mockConfig as any);

    expect(config.priority).toEqual(['subscription', 'api-credits', 'ollama']);
    expect(config.taskMappings).toEqual({});
    expect(config.autoFallback).toBe(true);
    expect(config.thresholds.subscriptionAlertPercent).toBe(80);
    expect(config.thresholds.subscriptionFallbackPercent).toBe(100);
    expect(config.harvey.baseUrl).toBe('http://localhost:11434');
    expect(config.subscription.plan).toBe('pro');
    expect(config.subscription.dailyLimit).toBe(30);
    expect(config.subscription.rollingWindowDays).toBe(7);
  });

  it('loads custom configuration from settings', async () => {
    const mockConfig = {
      priority: ['subscription', 'ollama'],
      taskMappings: { 'code-review': 'ollama' },
      autoFallback: false,
      thresholds: {
        subscriptionAlertPercent: 90,
        subscriptionFallbackPercent: 95
      },
      harvey: {
        baseUrl: 'http://localhost:9999'
      },
      subscription: {
        plan: 'max',
        dailyLimit: 50,
        rollingWindowDays: 14
      },
      get: vi.fn()
    };

    const config = await loadConfiguration(mockConfig as any);

    expect(config.priority).toEqual(['subscription', 'ollama']);
    expect(config.taskMappings).toEqual({ 'code-review': 'ollama' });
    expect(config.autoFallback).toBe(false);
    expect(config.thresholds.subscriptionAlertPercent).toBe(90);
    expect(config.thresholds.subscriptionFallbackPercent).toBe(95);
    expect(config.harvey.baseUrl).toBe('http://localhost:9999');
    expect(config.subscription.plan).toBe('max');
    expect(config.subscription.dailyLimit).toBe(50);
    expect(config.subscription.rollingWindowDays).toBe(14);
  });
});

describe('Routing Configuration - Validation', () => {
  it('validates correct configuration', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription', 'api-credits'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      harvey: {
        baseUrl: 'http://localhost:11434'
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    const result = validateConfiguration(config);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates config with ollama in priority but empty Harvey baseUrl', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription', 'ollama', 'api-credits'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    const logger = new Logger(LogLevel.INFO);
    const result = validateConfiguration(config, logger);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('ollama in priority but Harvey baseUrl is empty');
  });

  it('validates threshold order (fallback < alert)', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 90,
        subscriptionFallbackPercent: 80 // Fallback < alert - invalid!
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    const logger = new Logger(LogLevel.INFO);
    const result = validateConfiguration(config, logger);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Fallback threshold (80%) must be >= alert threshold (90%)');
  });

  it('validates positive quota limit values', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'pro',
        dailyLimit: -1, // Invalid!
        rollingWindowDays: 7
      }
    };

    const logger = new Logger(LogLevel.INFO);
    const result = validateConfiguration(config, logger);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('dailyLimit must be > 0');
  });

  it('validates plan is pro or max', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'invalid' as any, // Invalid!
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    const logger = new Logger(LogLevel.INFO);
    const result = validateConfiguration(config, logger);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("plan must be 'pro' or 'max'");
  });

  it('validates positive rollingWindowDays', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 0 // Invalid!
      }
    };

    const logger = new Logger(LogLevel.INFO);
    const result = validateConfiguration(config, logger);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('rollingWindowDays must be > 0');
  });

  it('logs validation errors to logger', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription', 'ollama'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    const logger = new Logger(LogLevel.INFO);
    validateConfiguration(config, logger);

    const warnings = logger.getEntriesByCategory('RoutingConfig');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].level).toBe(LogLevel.ERROR);
  });

  it('accumulates multiple validation errors', () => {
    const config: RoutingConfiguration = {
      priority: ['subscription', 'ollama'],
      taskMappings: {},
      autoFallback: true,
      thresholds: {
        subscriptionAlertPercent: 90,
        subscriptionFallbackPercent: 80
      },
      harvey: {
        baseUrl: ''
      },
      subscription: {
        plan: 'invalid' as any,
        dailyLimit: -1,
        rollingWindowDays: 0
      }
    };

    const logger = new Logger(LogLevel.INFO);
    const result = validateConfiguration(config, logger);

    expect(result.valid).toBe(false);
    // Should have errors for: empty baseUrl, threshold order, invalid plan, negative dailyLimit, zero rollingWindowDays
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});
