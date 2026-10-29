/**
 * Unit tests for Routing Engine
 *
 * Tests subscription exhaustion logic and performance constraints.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoutingEngine, RoutingError, type RoutingRequest, ModelSource, type RoutingDecision } from '../../../../src/core/routing/routing-engine';
import type { RoutingConfiguration } from '../../../../src/core/routing/routing-config';
import type { QuotaCache } from '../../../../src/core/quota/quota-cache';

describe('Routing Engine', () => {
  let mockConfig: RoutingConfiguration;
  let mockQuotaCache: QuotaCache;
  let routingEngine: RoutingEngine;

  beforeEach(() => {
    // Setup mock configuration
    mockConfig = {
      enabled: true,
      priority: ['subscription', 'api-credits', 'ollama'],
      thresholds: {
        subscriptionAlertPercent: 80,
        apiCreditsAlertPercent: 20
      },
      taskMappings: {},
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    // Setup mock quota cache
    mockQuotaCache = {
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7,
        rollingWindowStart: '2024-01-01',
        rollingWindowEnd: '2024-01-08',
        currentUsage: 10,
        remainingQuota: 20,
        percentUsed: 33.33,
        lastFetchTime: Date.now(),
        stale: false
      },
      apiCredits: {
        balance: 1000,
        authenticated: true,
        stale: false,
        lastFetchTime: Date.now()
      },
      ollama: {
        available: false,
        harveyReachable: false,
        circuitBreakerState: 'closed'
      }
    };
  });

  // ============================================================
  // T028: User Story 3 Unit Test - Subscription Exhaustion Logic
  // ============================================================

  describe('T028: Subscription exhaustion logic', () => {
    it('should fallback to API credits when subscription exhausted', async () => {
      // Setup: subscription exhausted, API credits available
      mockQuotaCache.subscription.currentUsage = 30;
      mockQuotaCache.subscription.remainingQuota = 0;
      mockQuotaCache.subscription.percentUsed = 100;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'test-001'
      };

      const decision = await routingEngine.route(request);

      // Verify routing decision
      expect(decision.source).toBe('api-credits');
      expect(decision.reason).toContain('api-credits');
      expect(decision.reason).toContain('Priority fallback');
    });

    it('should return false for isAvailable("subscription") when exhausted', async () => {
      mockQuotaCache.subscription.currentUsage = 30;
      mockQuotaCache.subscription.remainingQuota = 0;
      mockQuotaCache.subscription.percentUsed = 100;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const isAvailable = await routingEngine.isAvailable('subscription' as ModelSource);
      expect(isAvailable).toBe(false);
    });

    it('should return true for isAvailable("api-credits") when balance > 0', async () => {
      mockQuotaCache.apiCredits.balance = 1000;
      mockQuotaCache.apiCredits.authenticated = true;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const isAvailable = await routingEngine.isAvailable('api-credits' as ModelSource);
      expect(isAvailable).toBe(true);
    });

    it('should return false for isAvailable("api-credits") when balance <= 0', async () => {
      mockQuotaCache.apiCredits.balance = 0;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const isAvailable = await routingEngine.isAvailable('api-credits' as ModelSource);
      expect(isAvailable).toBe(false);
    });

    it('should return false for isAvailable("api-credits") when not authenticated', async () => {
      mockQuotaCache.apiCredits.balance = 1000;
      mockQuotaCache.apiCredits.authenticated = false;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const isAvailable = await routingEngine.isAvailable('api-credits' as ModelSource);
      expect(isAvailable).toBe(false);
    });

    it('should prefer subscription over API credits when both available', async () => {
      // Setup: both subscription and API credits available
      mockQuotaCache.subscription.currentUsage = 10;
      mockQuotaCache.subscription.remainingQuota = 20;
      mockQuotaCache.subscription.percentUsed = 33.33;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'test-002'
      };

      const decision = await routingEngine.route(request);

      // Verify routing decision prefers subscription
      expect(decision.source).toBe('subscription');
      expect(decision.reason).toContain('subscription');
    });
  });

  // ============================================================
  // T029: User Story 3 Unit Test - Performance Constraint
  // ============================================================

  describe('T029: Performance constraint (<200ms median latency)', () => {
    it('should have median latency < 200ms for 1000 consecutive route() calls', async () => {
      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'perf-test-001'
      };

      const latenciesMs: number[] = [];

      // Run 1000 consecutive route() calls
      for (let i = 0; i < 1000; i++) {
        request.requestId = `perf-test-${i}`;
        const startTime = performance.now();
        await routingEngine.route(request);
        const endTime = performance.now();
        latenciesMs.push(endTime - startTime);
      }

      // Calculate median
      const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
      const median = sortedLatencies[500]; // Zero-indexed, so 500 is median

      // Verify median < 200ms
      expect(median).toBeLessThan(200);

      // Verify P95 < 500ms (95th percentile)
      const p95 = sortedLatencies[950];
      expect(p95).toBeLessThan(500);
    });

    it('should have isAvailable() call latency < 200ms for all sources', async () => {
      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const sources: ModelSource[] = ['subscription', 'api-credits', 'ollama'];
      const latenciesMs: number[] = [];

      // Measure latency for each source
      for (const source of sources) {
        const startTime = performance.now();
        await routingEngine.isAvailable(source);
        const endTime = performance.now();
        latenciesMs.push(endTime - startTime);
      }

      // Verify all latencies < 200ms
      for (const latency of latenciesMs) {
        expect(latency).toBeLessThan(200);
      }

      // Verify median < 200ms across all sources
      const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
      const median = sortedLatencies[1]; // 3 items, index 1 is median
      expect(median).toBeLessThan(200);
    });

    it('should have getQuotaState() latency < 200ms', () => {
      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const startTime = performance.now();
      const quotaState = routingEngine.getQuotaState();
      const endTime = performance.now();
      const latency = endTime - startTime;

      expect(quotaState).toBeDefined();
      expect(latency).toBeLessThan(200);
    });
  });

  // ============================================================
  // Additional Integration Tests
  // ============================================================

  describe('Quota state management', () => {
    it('should return correct quota snapshot via getQuotaState()', () => {
      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const quotaState = routingEngine.getQuotaState();

      expect(quotaState).toEqual({
        subscription: {
          plan: 'pro',
          dailyLimit: 30,
          rollingWindowDays: 7,
          currentUsage: 10,
          remainingQuota: 20,
          percentUsed: 33.33,
          rollingWindowStart: '2024-01-01',
          rollingWindowEnd: '2024-01-08'
        },
        apiCredits: {
          balance: 1000,
          authenticated: true,
          stale: false,
          lastFetchTime: expect.any(Number)
        },
        ollama: {
          available: false,
          harveyReachable: false,
          circuitBreakerState: 'closed'
        }
      });
    });
  });

  describe('Routing priority fallback', () => {
    it('should fallback to Ollama when subscription and API credits exhausted', async () => {
      // Setup: subscription exhausted, API credits exhausted, Ollama available
      mockQuotaCache.subscription.currentUsage = 30;
      mockQuotaCache.subscription.remainingQuota = 0;
      mockQuotaCache.subscription.percentUsed = 100;

      mockQuotaCache.apiCredits.balance = 0;
      mockQuotaCache.apiCredits.authenticated = true;

      mockQuotaCache.ollama.available = true;
      mockQuotaCache.ollama.harveyReachable = true;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'test-003'
      };

      const decision = await routingEngine.route(request);

      expect(decision.source).toBe('ollama');
      expect(decision.reason).toContain('ollama');
      expect(decision.reason).toContain('Priority fallback');
    });

    it('should throw error when all sources are unavailable', async () => {
      // Setup: all sources unavailable
      mockQuotaCache.subscription.currentUsage = 30;
      mockQuotaCache.subscription.remainingQuota = 0;
      mockQuotaCache.subscription.percentUsed = 100;

      mockQuotaCache.apiCredits.balance = 0;
      mockQuotaCache.apiCredits.authenticated = false;

      mockQuotaCache.ollama.available = false;
      mockQuotaCache.ollama.harveyReachable = false;

      routingEngine = new RoutingEngine(mockConfig, mockQuotaCache);

      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'test-004'
      };

      await expect(routingEngine.route(request)).rejects.toThrow(RoutingError);
      await expect(routingEngine.route(request)).rejects.toMatchObject({
        code: 'NO_AVAILABLE_SOURCES'
      });
    });
  });
});
