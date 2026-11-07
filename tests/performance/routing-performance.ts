/**
 * Performance Validation Tests for Model Cost Optimization
 *
 * Task T058: Performance validation
 * - Measures median latency <200ms (SC-003)
 * - Measures P95 latency <500ms (SC-003)
 * - Verifies routing adaptation <1s for quota exhaustion transition (SC-003)
 * - Benchmarks with 1000 route() calls
 *
 * Usage:
 *   npm run test:performance
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RoutingEngine, RoutingError, type RoutingRequest, ModelSource } from '../../src/core/routing/routing-engine';
import type { RoutingConfiguration } from '../../src/core/routing/routing-config';
import type { QuotaCache } from '../../src/core/quota/quota-cache';

describe('T058: Performance Validation', () => {
  let config: RoutingConfiguration;
  let quotaCache: QuotaCache;
  let routingEngine: RoutingEngine;

  // Thresholds from SC-003
  const THRESHOLDS = {
    MEDIAN_LATENCY_MS: 200,
    P95_LATENCY_MS: 500,
    ADAPTATION_TIME_MS: 1000,
    NUM_REQUESTS: 1000
  };

  beforeEach(() => {
    // Reset configuration for each test
    config = {
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

    quotaCache = {
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
        available: true,
        harveyReachable: true,
        circuitBreakerState: 'closed'
      }
    };

    routingEngine = new RoutingEngine(config, quotaCache);
  });

  // ============================================================
  // Basic Latency Benchmark (T029 re-verification)
  // ============================================================

  describe('T029 (re-verify): Median latency < 200ms for 1000 route() calls', () => {
    it('should complete 1000 route() calls with median latency < 200ms', async () => {
      const latenciesMs: number[] = [];
      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'perf-basic-001'
      };

      console.log(`\n[T058] Running ${THRESHOLDS.NUM_REQUESTS} route() calls for latency benchmark...`);

      for (let i = 0; i < THRESHOLDS.NUM_REQUESTS; i++) {
        request.requestId = `perf-basic-${i}`;
        const startTime = performance.now();
        await routingEngine.route(request);
        const endTime = performance.now();
        latenciesMs.push(endTime - startTime);
      }

      // Calculate statistics
      const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
      const median = sortedLatencies[Math.floor(sortedLatencies.length / 2)];
      const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
      const min = sortedLatencies[0];
      const max = sortedLatencies[sortedLatencies.length - 1];
      const avg = latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length;

      console.log('\n[T058] Latency Statistics for route() calls:');
      console.log(`  Requests: ${THRESHOLDS.NUM_REQUESTS}`);
      console.log(`  Median: ${median.toFixed(2)}ms (threshold: ${THRESHOLDS.MEDIAN_LATENCY_MS}ms)`);
      console.log(`  P95: ${p95.toFixed(2)}ms (threshold: ${THRESHOLDS.P95_LATENCY_MS}ms)`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);

      // Verify thresholds and log warnings if not met
      if (median >= THRESHOLDS.MEDIAN_LATENCY_MS) {
        console.warn(`\n[T058] WARNING: Median latency ${median.toFixed(2)}ms exceeds threshold ${THRESHOLDS.MEDIAN_LATENCY_MS}ms`);
      }
      if (p95 >= THRESHOLDS.P95_LATENCY_MS) {
        console.warn(`\n[T058] WARNING: P95 latency ${p95.toFixed(2)}ms exceeds threshold ${THRESHOLDS.P95_LATENCY_MS}ms`);
      }

      expect(median).toBeLessThan(THRESHOLDS.MEDIAN_LATENCY_MS);
      expect(p95).toBeLessThan(THRESHOLDS.P95_LATENCY_MS);
    });
  });

  // ============================================================
  // Routing Adaptation Time for Quota Exhaustion Transition
  // ============================================================

  describe('Routing adaptation time < 1s for quota exhaustion transition', () => {
    it('should adapt to fallback source within 1s when quota exhausted', async () => {
      console.log('\n[T058] Measuring routing adaptation time for quota exhaustion...');

      // Start with subscription available
      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'adaptation-test-001'
      };

      // Verify initial routing to subscription
      const initialDecision = await routingEngine.route(request);
      expect(initialDecision.source).toBe('subscription');

      // Simulate quota exhaustion
      quotaCache.subscription.currentUsage = 30;
      quotaCache.subscription.remainingQuota = 0;
      quotaCache.subscription.percentUsed = 100;

      // Measure time to adapt and route to fallback
      const adaptationStartTime = performance.now();
      const exhaustedDecision = await routingEngine.route(request);
      const adaptationEndTime = performance.now();
      const adaptationTimeMs = adaptationEndTime - adaptationStartTime;

      console.log('\n[T058] Adaptation Statistics:');
      console.log(`  Adaptation time: ${adaptationTimeMs.toFixed(2)}ms (threshold: ${THRESHOLDS.ADAPTATION_TIME_MS}ms)`);
      console.log(`  Final source: ${exhaustedDecision.source}`);
      console.log(`  Reason: ${exhaustedDecision.reason}`);

      // Verify thresholds and log warnings if not met
      if (adaptationTimeMs >= THRESHOLDS.ADAPTATION_TIME_MS) {
        console.warn(`\n[T058] WARNING: Adaptation time ${adaptationTimeMs.toFixed(2)}ms exceeds threshold ${THRESHOLDS.ADAPTATION_TIME_MS}ms`);
      }

      // Verify fallback behavior
      expect(exhaustedDecision.source).toBe('api-credits');
      expect(exhaustedDecision.reason).toContain('api-credits');
      expect(adaptationTimeMs).toBeLessThan(THRESHOLDS.ADAPTATION_TIME_MS);
    });

    it('should complete 10 fallback transitions within 1s each', async () => {
      console.log('\n[T058] Measuring adaptation time for 10 consecutive exhaustion transitions...');

      const adaptationTimesMs: number[] = [];
      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'adaptation-seq-001'
      };

      for (let i = 0; i < 10; i++) {
        // Reset to subscription available
        quotaCache.subscription.currentUsage = 10;
        quotaCache.subscription.remainingQuota = 20;
        quotaCache.subscription.percentUsed = 33.33;

        request.requestId = `adaptation-seq-${i}`;

        // Initial routing to subscription
        await routingEngine.route(request);

        // Exhaust quota
        quotaCache.subscription.currentUsage = 30;
        quotaCache.subscription.remainingQuota = 0;
        quotaCache.subscription.percentUsed = 100;

        // Measure adaptation time
        const adaptationStartTime = performance.now();
        const decision = await routingEngine.route(request);
        const adaptationEndTime = performance.now();
        const adaptationTimeMs = adaptationEndTime - adaptationStartTime;

        adaptationTimesMs.push(adaptationTimeMs);

        // Verify fallback
        expect(decision.source).toBe('api-credits');
      }

      // Calculate statistics
      const sortedTimes = [...adaptationTimesMs].sort((a, b) => a - b);
      const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
      const max = sortedTimes[sortedTimes.length - 1];
      const min = sortedTimes[0];
      const avg = adaptationTimesMs.reduce((a, b) => a + b, 0) / adaptationTimesMs.length;

      console.log('\n[T058] Adaptation Time Statistics (10 transitions):');
      console.log(`  Median: ${median.toFixed(2)}ms (threshold: ${THRESHOLDS.ADAPTATION_TIME_MS}ms)`);
      console.log(`  Min: ${min.toFixed(2)}ms`);
      console.log(`  Max: ${max.toFixed(2)}ms`);
      console.log(`  Average: ${avg.toFixed(2)}ms`);

      // Verify threshold and log warning if not met
      if (median >= THRESHOLDS.ADAPTATION_TIME_MS) {
        console.warn(`\n[T058] WARNING: Median adaptation time ${median.toFixed(2)}ms exceeds threshold ${THRESHOLDS.ADAPTATION_TIME_MS}ms`);
      }
      if (max >= THRESHOLDS.ADAPTATION_TIME_MS) {
        console.warn(`\n[T058] WARNING: Max adaptation time ${max.toFixed(2)}ms exceeds threshold ${THRESHOLDS.ADAPTATION_TIME_MS}ms`);
      }

      expect(median).toBeLessThan(THRESHOLDS.ADAPTATION_TIME_MS);
      expect(max).toBeLessThan(THRESHOLDS.ADAPTATION_TIME_MS);
    });
  });

  // ============================================================
  // Enhanced Benchmark with Multiple Source Types
  // ============================================================

  describe('Comprehensive performance benchmark with multiple sources', () => {
    it('should benchmark routing to each source type', async () => {
      console.log('\n[T058] Benchmarking routing to each source type...');

      const benchmarkResults: { source: string; medianLatency: number; p95Latency: number }[] = [];
      const sources = [
        {
          name: 'subscription',
          setup: () => {
            quotaCache.subscription.currentUsage = 10;
            quotaCache.subscription.remainingQuota = 20;
          }
        },
        {
          name: 'api-credits',
          setup: () => {
            quotaCache.subscription.currentUsage = 30; // Exhausted
            quotaCache.subscription.remainingQuota = 0;
            quotaCache.apiCredits.balance = 1000;
            quotaCache.apiCredits.authenticated = true;
          }
        },
        {
          name: 'ollama',
          setup: () => {
            quotaCache.subscription.currentUsage = 30; // Exhausted
            quotaCache.subscription.remainingQuota = 0;
            quotaCache.apiCredits.balance = 0; // Exhausted
            quotaCache.ollama.available = true;
            quotaCache.ollama.harveyReachable = true;
            quotaCache.ollama.circuitBreakerState = 'closed';
          }
        }
      ];

      for (const source of sources) {
        source.setup();
        const latenciesMs: number[] = [];
        const request: RoutingRequest = {
          taskType: 'code-generation',
          requestId: `benchmark-${source.name}-001`
        };

        console.log(`\n[T058] Running 100 calls to ${source.name}...`);

        for (let i = 0; i < 100; i++) {
          request.requestId = `benchmark-${source.name}-${i}`;
          const startTime = performance.now();
          const decision = await routingEngine.route(request);
          const endTime = performance.now();

          expect(decision.source).toBe(source.name);
          latenciesMs.push(endTime - startTime);
        }

        const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
        const median = sortedLatencies[Math.floor(sortedLatencies.length / 2)];
        const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

        benchmarkResults.push({ source: source.name, medianLatency: median, p95Latency: p95 });

        console.log(`  ${source.name}: Median=${median.toFixed(2)}ms, P95=${p95.toFixed(2)}ms`);

        // Verify threshold for each source
        if (median >= THRESHOLDS.MEDIAN_LATENCY_MS) {
          console.warn(`  WARNING: Median latency ${median.toFixed(2)}ms exceeds threshold ${THRESHOLDS.MEDIAN_LATENCY_MS}ms for ${source.name}`);
        }
      }

      console.log('\n[T058] Summary:');
      for (const result of benchmarkResults) {
        console.log(`  ${result.source}: Median=${result.medianLatency.toFixed(2)}ms, P95=${result.p95Latency.toFixed(2)}ms`);
        expect(result.medianLatency).toBeLessThan(THRESHOLDS.MEDIAN_LATENCY_MS);
        expect(result.p95Latency).toBeLessThan(THRESHOLDS.P95_LATENCY_MS);
      }
    });
  });

  // ============================================================
  // Memory and Resource Usage
  // ============================================================

  describe('Memory and resource usage under load', () => {
    it('should handle 1000 route() calls without excessive memory growth', async () => {
      console.log('\n[T058] Measuring memory usage under load...');

      const initialMemory = process.memoryUsage();
      const request: RoutingRequest = {
        taskType: 'code-generation',
        requestId: 'memory-test-001'
      };

      console.log(`  Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      for (let i = 0; i < THRESHOLDS.NUM_REQUESTS; i++) {
        request.requestId = `memory-test-${i}`;
        await routingEngine.route(request);
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowthMb = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

      console.log(`  Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Memory growth: ${memoryGrowthMb.toFixed(2)}MB`);

      // Verify memory growth is reasonable (< 10MB for 1000 calls)
      expect(memoryGrowthMb).toBeLessThan(10);

      if (memoryGrowthMb >= 10) {
        console.warn(`\n[T058] WARNING: Memory growth ${memoryGrowthMb.toFixed(2)}MB may indicate a memory leak`);
      }
    });
  });

  // ============================================================
  // Validation Scenario 7: Multi-Session Consistency Performance
  // ============================================================

  describe('T058-S7: Multi-Session Quota Consistency Performance', () => {
    it('should handle concurrent routing requests efficiently', async () => {
      console.log('\n[T058] Measuring concurrent request handling...');

      const numConcurrent = 100;
      const latenciesMs: number[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < numConcurrent; i++) {
        const promise = (async () => {
          const request: RoutingRequest = {
            taskType: 'code-generation',
            requestId: `concurrent-${i}`
          };

          const startTime = performance.now();
          await routingEngine.route(request);
          const endTime = performance.now();
          latenciesMs.push(endTime - startTime);
        })();

        promises.push(promise);
      }

      await Promise.all(promises);

      const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
      const median = sortedLatencies[Math.floor(sortedLatencies.length / 2)];
      const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];

      console.log('\n[T058] Concurrent Request Statistics:');
      console.log(`  Concurrent requests: ${numConcurrent}`);
      console.log(`  Median latency: ${median.toFixed(2)}ms (threshold: ${THRESHOLDS.MEDIAN_LATENCY_MS}ms)`);
      console.log(`  P95 latency: ${p95.toFixed(2)}ms (threshold: ${THRESHOLDS.P95_LATENCY_MS}ms)`);

      // Verify thresholds and log warnings if not met
      if (median >= THRESHOLDS.MEDIAN_LATENCY_MS) {
        console.warn(`\n[T058] WARNING: Median latency ${median.toFixed(2)}ms exceeds threshold ${THRESHOLDS.MEDIAN_LATENCY_MS}ms for concurrent requests`);
      }
      if (p95 >= THRESHOLDS.P95_LATENCY_MS) {
        console.warn(`\n[T058] WARNING: P95 latency ${p95.toFixed(2)}ms exceeds threshold ${THRESHOLDS.P95_LATENCY_MS}ms for concurrent requests`);
      }

      expect(median).toBeLessThan(THRESHOLDS.MEDIAN_LATENCY_MS);
      expect(p95).toBeLessThan(THRESHOLDS.P95_LATENCY_MS);
    });
  });
});
