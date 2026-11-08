/**
 * Performance Validation (T058)
 *
 * Validates performance requirements:
 * - Median latency <200ms for routing decisions
 * - P95 latency <500ms
 * - Routing adaptation <1s for quota exhaustion transition
 * - Benchmark with 1000 route() calls
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoutingEngine, RoutingRequest, ModelSource } from '../../../../src/core/routing/routing-engine';
import type { RoutingConfiguration } from '../../../../src/core/routing/routing-config';
import type { QuotaCache } from '../../../../src/core/quota/quota-cache';
import { OllamaAdapter } from '../../../../src/core/routing/ollama-adapter';

// Mock OllamaAdapter to prevent real HTTP calls in tests
vi.mock('../../../../src/core/routing/ollama-adapter');

describe('T058: Performance validation', () => {
  let config: RoutingConfiguration;
  let quotaCache: QuotaCache;
  let routingEngine: RoutingEngine;

  beforeEach(() => {
    // Setup mock configuration
    config = {
      enabled: true,
      priority: ['subscription', 'api-credits', 'ollama'],
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      taskMappings: {
        'generation': 'subscription'
      },
      autoFallback: false,
      harvey: {
        baseUrl: 'http://localhost:11434'
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    // Mock OllamaAdapter to return successful Harvey recommendation
    vi.mocked(OllamaAdapter).mockImplementation(() => ({
      getRecommendation: vi.fn().mockResolvedValue({
        routedTo: 'subscription',
        model: 'claude-haiku',
        confidence: 0.8
      }),
      getCircuitBreakerState: vi.fn().mockReturnValue('closed'),
      resetCircuitBreaker: vi.fn()
    } as any));

    // Setup mock quota cache
    quotaCache = {
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7,
        rollingWindowStart: '2024-01-01',
        rollingWindowEnd: '2024-01-08',
        currentUsage: 0,
        remainingQuota: 30,
        percentUsed: 0,
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
        available: true,
        harveyReachable: true,
        circuitBreakerState: 'closed',
        autoFallbackTriggered: false
      }
    };

    routingEngine = new RoutingEngine(config, quotaCache);
  });

  it('should meet median latency <200ms with 1000 route() calls', async () => {
    const iterations = 1000;
    const latencies: number[] = [];

    // Use explicit mapping to avoid Harvey calls and test pure routing logic
    for (let i = 0; i < iterations; i++) {
      const req: RoutingRequest = {
        taskType: 'generation',
        requestId: `perf-test-${i}`
      };

      const startTime = performance.now();
      await routingEngine.route(req);
      const endTime = performance.now();
      latencies.push(endTime - startTime);
    }

    // Calculate statistics
    const sorted = [...latencies].sort((a, b) => a - b);
    const median = sorted[Math.floor(iterations / 2)];
    const p95 = sorted[Math.floor(iterations * 0.95)];
    const p99 = sorted[Math.floor(iterations * 0.99)];
    const min = sorted[0];
    const max = sorted[iterations - 1];
    const mean = latencies.reduce((sum, l) => sum + l, 0) / iterations;

    // Validate against requirements
    expect(median).toBeLessThan(200); // SC-003 requirement
    expect(p95).toBeLessThan(500);    // P95 requirement

    // Log performance summary
    console.log('\n=== Performance Validation Results (1000 calls) ===');
    console.log(`Min latency:    ${min.toFixed(2)} ms`);
    console.log(`Median latency: ${median.toFixed(2)} ms (requirement: < 200ms)${median < 200 ? ' ✓' : ' ✗'}`);
    console.log(`Mean latency:   ${mean.toFixed(2)} ms`);
    console.log(`P95 latency:    ${p95.toFixed(2)} ms (requirement: < 500ms)${p95 < 500 ? ' ✓' : ' ✗'}`);
    console.log(`P99 latency:    ${p99.toFixed(2)} ms`);
    console.log(`Max latency:    ${max.toFixed(2)} ms`);
    console.log('==================================================\n');

    // Warn if thresholds not met
    if (median >= 200) {
      console.warn(`⚠️  Median latency ${median.toFixed(2)}ms exceeds 200ms threshold`);
    }
    if (p95 >= 500) {
      console.warn(`⚠️  P95 latency ${p95.toFixed(2)}ms exceeds 500ms threshold`);
    }
  });

  it('should complete routing adaptation <1s for quota exhaustion transition', async () => {
    // Step 1: Exhaust subscription quota
    quotaCache.subscription.currentUsage = 29;
    quotaCache.subscription.remainingQuota = 1;

    const routingEngine1 = new RoutingEngine(config, quotaCache);

    // Last subscription request
    const req1: RoutingRequest = {
      taskType: 'generation',
      requestId: 'transition-1'
    };

    const decision1 = await routingEngine1.route(req1);
    expect(decision1.source).toBe('subscription');

    // Step 2: Transition to API credits (quota exhausted)
    const transitionStartTime = performance.now();

    // Update quota to exhausted
    quotaCache.subscription.currentUsage = 30;
    quotaCache.subscription.remainingQuota = 0;

    const routingEngine2 = new RoutingEngine(config, { ...quotaCache });

    const req2: RoutingRequest = {
      taskType: 'generation',
      requestId: 'transition-2'
    };

    const decision2 = await routingEngine2.route(req2);
    const transitionEndTime = performance.now();
    const adaptationLatency = transitionEndTime - transitionStartTime;

    expect(decision2.source).toBe('api-credits');
    expect(adaptationLatency).toBeLessThan(1000); // SC-003 requirement

    console.log('\n=== Quota Exhaustion Transition ===');
    console.log(`Transition latency: ${adaptationLatency.toFixed(2)} ms (requirement: < 1000ms)${adaptationLatency < 1000 ? ' ✓' : ' ✗'}`);
    console.log('===================================\n');

    if (adaptationLatency >= 1000) {
      console.warn(`⚠️  Routing adaptation ${adaptationLatency.toFixed(2)}ms exceeds 1s threshold`);
    }
  });

  it('should handle isAvailable() checks within performance thresholds', async () => {
    const sources: ModelSource[] = ['subscription', 'api-credits', 'ollama'];
    const iterations = 1000;
    const latencies: Record<ModelSource, number[]> = {
      subscription: [],
      'api-credits': [],
      ollama: []
    };

    // Measure isAvailable() latency for each source
    for (let i = 0; i < iterations; i++) {
      for (const source of sources) {
        const startTime = performance.now();
        await routingEngine.isAvailable(source);
        const endTime = performance.now();
        latencies[source].push(endTime - startTime);
      }
    }

    // Validate all sources
    for (const source of sources) {
      const sorted = [...latencies[source]].sort((a, b) => a - b);
      const median = sorted[Math.floor(latencies[source].length / 2)];
      const p95 = sorted[Math.floor(latencies[source].length * 0.95)];

      expect(median).toBeLessThan(200); // isAvailable should be fast
      expect(p95).toBeLessThan(500);

      console.log(`\n=== isAvailable(${source}) Performance ===`);
      console.log(`Median: ${median.toFixed(2)} ms (requirement: < 200ms)${median < 200 ? ' ✓' : ' ✗'}`);
      console.log(`P95:    ${p95.toFixed(2)} ms (requirement: < 500ms)${p95 < 500 ? ' ✓' : ' ✗'}`);
      console.log('====================================\n');
    }
  });

  it('should complete getQuotaState() call within performance threshold', () => {
    const iterations = 1000;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const quotaState = routingEngine.getQuotaState();
      const endTime = performance.now();
      latencies.push(endTime - startTime);

      // Verify data is correct
      expect(quotaState).toBeDefined();
      expect(quotaState.subscription.remainingQuota).toBe(30);
      expect(quotaState.apiCredits.balance).toBe(1000);
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const median = sorted[Math.floor(iterations / 2)];
    const p95 = sorted[Math.floor(iterations * 0.95)];

    // getQuotaState() should be very fast (no I/O)
    expect(median).toBeLessThan(50); // Stricter threshold for synchronous call
    expect(p95).toBeLessThan(100);

    console.log('\n=== getQuotaState() Performance ===');
    console.log(`Median: ${median.toFixed(2)} ms (requirement: < 50ms)${median < 50 ? ' ✓' : ' ✗'}`);
    console.log(`P95:    ${p95.toFixed(2)} ms (requirement: < 100ms)${p95 < 100 ? ' ✓' : ' ✗'}`);
    console.log('=================================\n');

    if (median >= 50) {
      console.warn(`⚠️  getQuotaState() median ${median.toFixed(2)}ms exceeds 50ms threshold`);
    }
  });
});
