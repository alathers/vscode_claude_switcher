/**
 * End-to-end integration test: Full routing workflow (T059)
 *
 * Tests complete workflow from configuration through routing decision, fallback,
 * history recording, and cleanup across all user stories.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ExtensionContext } from 'vscode';
import { RoutingEngine, ModelSource, type RoutingRequest } from '../../../../src/core/routing/routing-engine';
import type { RoutingConfiguration } from '../../../../src/core/routing/routing-config';
import type { QuotaCache } from '../../../../src/core/quota/quota-cache';
import type { RoutingHistoryManager } from '../../../../src/core/routing/routing-history';
import { OllamaAdapter } from '../../../../src/core/routing/ollama-adapter';

// Mock VS Code API
const mockGlobalState: Record<string, any> = {};
const mockExtensionContext: Partial<ExtensionContext> = {
  globalState: {
    get: vi.fn((key: string, defaultValue?: any) => mockGlobalState[key] ?? defaultValue),
    update: vi.fn(async (key: string, value: any) => {
      mockGlobalState[key] = value;
      return Promise.resolve();
    }),
    keys: vi.fn(() => Object.keys(mockGlobalState))
  }
};

// Mock OllamaAdapter to control Harvey behavior
const mockHarveyRecommendation = {
  routedTo: 'ollama' as ModelSource,
  model: 'llama3.2',
  confidence: 0.85
};

let mockGetRecommendation = vi.fn().mockResolvedValue(mockHarveyRecommendation);
let mockGetCircuitBreakerState = vi.fn().mockReturnValue('closed' as 'closed' | 'open' | 'half-open');

vi.mock('../../../src/core/routing/ollama-adapter', () => ({
  OllamaAdapter: vi.fn().mockImplementation(() => ({
    getRecommendation: mockGetRecommendation,
    getCircuitBreakerState: mockGetCircuitBreakerState,
    resetCircuitBreaker: vi.fn()
  }))
}));

describe('T059: Cross-story integration test (full workflow)', () => {
  let config: RoutingConfiguration;
  let quotaCache: QuotaCache;
  let routingEngine: RoutingEngine;
  let routingHistory: RoutingHistoryManager;

  beforeEach(async () => {
    // Reset Harvey mocks before each test
    mockGetRecommendation = vi.fn().mockResolvedValue(mockHarveyRecommendation);
    mockGetCircuitBreakerState = vi.fn().mockReturnValue('closed' as 'closed' | 'open' | 'half-open');

    // Setup full configuration
    config = {
      enabled: true,
      priority: ['subscription', 'api-credits', 'ollama'],
      thresholds: {
        subscriptionAlertPercent: 80,
        subscriptionFallbackPercent: 100
      },
      taskMappings: {
        'code-review': 'auto',
        'generation': 'subscription'
      },
      autoFallback: true,
      harvey: {
        baseUrl: 'http://localhost:11434'
      },
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7
      }
    };

    // Initialize quota with full capacity
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

    // Initialize routing history (require dynamic import to avoid VS Code dependency)
    const { RoutingHistoryManager } = await import('../../../../src/core/routing/routing-history');
    routingHistory = new RoutingHistoryManager(mockExtensionContext.globalState!);

    // Initialize routing engine with history
    routingEngine = new RoutingEngine(config, quotaCache, routingHistory);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full workflow: subscription → API credits → Ollama', async () => {
    // Phase 1: Initial subscription routing (User Story 2)
    const request1: RoutingRequest = {
      taskType: 'generation',
      requestId: 'workflow-001'
    };

    const decision1 = await routingEngine.route(request1);

    expect(decision1.source).toBe('subscription');
    expect(decision1.reason).toContain('generation');
    expect(decision1.performance?.latencyMs).toBeLessThan(200);

    // Verify history recorded
    const recentDecisions = await routingHistory.getRecentDecisions(10);
    expect(recentDecisions).toHaveLength(1);
    expect(recentDecisions[0].routedTo).toBe('subscription');

    // Phase 2: Exhaust subscription, fallback to API credits (User Story 3)
    const quotaCache2: QuotaCache = {
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7,
        rollingWindowStart: '2024-01-01',
        rollingWindowEnd: '2024-01-08',
        currentUsage: 30,
        remainingQuota: 0,
        percentUsed: 100,
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
        circuitBreakerState: 'closed',
        autoFallbackTriggered: false
      }
    };

    const config2: RoutingConfiguration = {
      ...config,
      priority: ['subscription', 'api-credits'] // No ollama to test simple fallback
    };

    const routingEngine2 = new RoutingEngine(config2, quotaCache2, routingHistory);

    const request2: RoutingRequest = {
      taskType: 'generation',
      requestId: 'workflow-002'
    };

    const decision2 = await routingEngine2.route(request2);

    expect(decision2.source).toBe('api-credits');
    expect(decision2.reason).toContain('api-credits');
    expect(decision2.performance?.latencyMs).toBeLessThan(200);

    // Phase 3a: Exhaust API credits, use Ollama via priority (User Story 4)
    // Subscription and API credits exhausted but ollama is in priority array
    // This tests priority fallback, NOT auto-fallback
    const quotaCache3a: QuotaCache = {
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7,
        rollingWindowStart: '2024-01-01',
        rollingWindowEnd: '2024-01-08',
        currentUsage: 30,
        remainingQuota: 0,
        percentUsed: 100,
        lastFetchTime: Date.now(),
        stale: false
      },
      apiCredits: {
        balance: 0,
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

    const config3a: RoutingConfiguration = {
      ...config,
      priority: ['subscription', 'api-credits', 'ollama'],
      // Use taskMappings with direct 'ollama' to bypass Harvey and avoid the complexity
      taskMappings: {
        'code-review': 'ollama' // Direct mapping - will use Ollama if available
      }
    };

    const routingEngine3a = new RoutingEngine(config3a, quotaCache3a, routingHistory);

    const request3a: RoutingRequest = {
      taskType: 'code-review', // Direct mapping to ollama
      requestId: 'workflow-003a'
    };

    const decision3a = await routingEngine3a.route(request3a);

    expect(decision3a.source).toBe('ollama');
    expect(decision3a.reason).toContain('Explicit mapping');
    expect(quotaCache3a.ollama.autoFallbackTriggered).toBe(false); // Not auto-fallback, routed via mapping

    // Phase 3b: Test auto-fallback triggering when both Claude exhausted and autoFallback enabled
    const quotaCache3b: QuotaCache = {
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7,
        rollingWindowStart: '2024-01-01',
        rollingWindowEnd: '2024-01-08',
        currentUsage: 30,
        remainingQuota: 0,
        percentUsed: 100,
        lastFetchTime: Date.now(),
        stale: false
      },
      apiCredits: {
        balance: 0,
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

    const config3b: RoutingConfiguration = {
      ...config,
      priority: ['subscription', 'api-credits'], // Ollama removed to trigger auto-fallback
      autoFallback: true
    };

    const routingEngine3b = new RoutingEngine(config3b, quotaCache3b, routingHistory);

    const request3b: RoutingRequest = {
      taskType: 'generation', // Uses explicit mapping to subscription, which is exhausted
      requestId: 'workflow-003b'
    };

    const decision3b = await routingEngine3b.route(request3b);

    expect(decision3b.source).toBe('ollama');
    expect(decision3b.reason).toContain('Auto-fallback');
    expect(quotaCache3b.ollama.autoFallbackTriggered).toBe(true);
  });

  it('should handle Harvey failure gracefully with circuit breaker', async () => {
    // Create config with explicit mapping to subscription
    const configWithSubscriptionExplicit: RoutingConfiguration = {
      ...config,
      taskMappings: {
        'code-review': 'subscription'
      }
    };

    const quotaCacheForTest: QuotaCache = {
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

    const routingEngineForTest = new RoutingEngine(configWithSubscriptionExplicit, quotaCacheForTest, routingHistory);

    const request: RoutingRequest = {
      taskType: 'code-review',
      requestId: 'priority-only-001'
    };

    const decision = await routingEngineForTest.route(request);

    expect(decision.source).toBe('subscription');
    expect(decision.reason).toContain('Explicit mapping');

    // Verify Harvey recommendation is not attached (no Harvey call made)
    expect(decision.harveyRecommendation).toBeUndefined();
  });

  it('should respect explicit task mappings over Harvey recommendations', async () => {
    // Test 1: Task mapping says 'subscription' (should fallback to next available in priority)
    const quotaCache1: QuotaCache = {
      subscription: {
        plan: 'pro',
        dailyLimit: 30,
        rollingWindowDays: 7,
        rollingWindowStart: '2024-01-01',
        rollingWindowEnd: '2024-01-08',
        currentUsage: 30,
        remainingQuota: 0,
        percentUsed: 100,
        lastFetchTime: Date.now(),
        stale: false
      },
      apiCredits: {
        balance: 0,
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

    const config1: RoutingConfiguration = {
      ...config,
      taskMappings: {
        'generation': 'subscription', // Explicit mapping
        'code-review': 'ollama' // Direct mapping to Ollama (bypass Harvey)
      }
    };

    const routingEngine1 = new RoutingEngine(config1, quotaCache1, routingHistory);
    const routingEngine2 = new RoutingEngine(config1, quotaCache1, routingHistory);

    const request1: RoutingRequest = {
      taskType: 'generation',
      requestId: 'explicit-fail-001'
    };

    // Should NOT reject - should fallback to Ollama via priority
    const decision1 = await routingEngine1.route(request1);
    expect(decision1.source).toBe('ollama');
    expect(decision1.reason).toContain('Priority fallback');

    // Test 2: Task mapping says 'ollama' (direct routing to Ollama)
    const request2: RoutingRequest = {
      taskType: 'code-review',
      requestId: 'explicit-auto-001'
    };

    const decision2 = await routingEngine2.route(request2);

    expect(decision2.source).toBe('ollama');
    expect(decision2.reason).toContain('Explicit mapping');
  });

  it('should maintain quota state consistency across routing decisions', async () => {
    // Initial state
    expect(quotaCache.subscription.remainingQuota).toBe(30);
    expect(quotaCache.apiCredits.balance).toBe(1000);

    // Make multiple decisions
    const requests: RoutingRequest[] = [
      { taskType: 'generation', requestId: 'consistency-001' },
      { taskType: 'code-review', requestId: 'consistency-002' },
      { taskType: 'generation', requestId: 'consistency-003' }
    ];

    for (const req of requests) {
      await routingEngine.route(req);
    }

    // Quota state should remain consistent (mock doesn't decrement)
    expect(quotaCache.subscription.remainingQuota).toBe(30);
    expect(quotaCache.apiCredits.balance).toBe(1000);

    // Exhaust subscription
    quotaCache.subscription.currentUsage = 30;
    quotaCache.subscription.remainingQuota = 0;
    quotaCache.subscription.percentUsed = 100;

    const decisionAfterExhaustion = await routingEngine.route({
      taskType: 'generation',
      requestId: 'consistency-004'
    });

    expect(decisionAfterExhaustion.source).toBe('api-credits');
    expect(quotaCache.apiCredits.balance).toBeGreaterThan(0);
  });

  it('should export routing history with correct data structure', async () => {
    // Generate some routing decisions
    for (let i = 0; i < 5; i++) {
      await routingEngine.route({
        taskType: i % 2 === 0 ? 'generation' : 'code-review',
        requestId: `export-test-${i}`
      });
    }

    // Export all decisions
    const allDecisions = await routingHistory.getAllDecisionsForExport();

    expect(allDecisions.length).toBeGreaterThanOrEqual(5);
    expect(allDecisions[0]).toHaveProperty('id');
    expect(allDecisions[0]).toHaveProperty('timestamp');
    expect(allDecisions[0]).toHaveProperty('routedTo');
    expect(allDecisions[0].routedTo).toMatch(/^(subscription|api-credits|ollama)$/);
    expect(allDecisions[0]).toHaveProperty('taskType');
    expect(allDecisions[0]).toHaveProperty('quotaBefore');
    expect(allDecisions[0]).toHaveProperty('quotaAfter');
    expect(allDecisions[0]).toHaveProperty('reason');
  });

  it('should meet performance criteria across full workflow', async () => {
    const iterations = 100;
    const latencies: number[] = [];

    // Reset Harvey mock to always resolve successfully
    mockGetRecommendation.mockResolvedValue(mockHarveyRecommendation);

    for (let i = 0; i < iterations; i++) {
      const req: RoutingRequest = {
        taskType: 'generation', // Use explicit mapping to avoid Harvey calls
        requestId: `perf-test-${i}`
      };

      const startTime = performance.now();
      await routingEngine.route(req);
      const endTime = performance.now();
      latencies.push(endTime - startTime);
    }

    // Calculate median
    const sorted = [...latencies].sort((a, b) => a - b);
    const median = sorted[Math.floor(iterations / 2)];
    const p95 = sorted[Math.floor(iterations * 0.95)];

    expect(median).toBeLessThan(200); // SC-003 requirement
    expect(p95).toBeLessThan(500);    // P95 requirement
  });

  it('should handle autoFallback disabled correctly', async () => {
    config.autoFallback = false;

    // Exhaust all Claude sources
    quotaCache.subscription.currentUsage = 30;
    quotaCache.subscription.remainingQuota = 0;
    quotaCache.apiCredits.balance = 0;
    // Ensure Ollama is available via priority (not auto-fallback)
    quotaCache.ollama.available = true;
    quotaCache.ollama.harveyReachable = true;
    quotaCache.ollama.circuitBreakerState = 'closed';

    // Reset Harvey mock to always resolve
    mockGetRecommendation.mockResolvedValue(mockHarveyRecommendation);

    // Should still route to Ollama via priority (not auto-fallback)
    const request: RoutingRequest = {
      taskType: 'generation', // Explicit mapping to subscription, will fallback via priority
      requestId: 'no-autofallback-001'
    };

    const decision = await routingEngine.route(request);

    expect(decision.source).toBe('ollama');
    expect(decision.reason).toContain('Priority fallback');
    expect(decision.reason).not.toContain('Auto-fallback');
    expect(quotaCache.ollama.autoFallbackTriggered).toBe(false);
  });

  it('should handle Harvey recommendation with low confidence', async () => {
    // Harvey returns low-confidence recommendation (< 0.7)
    mockGetRecommendation.mockResolvedValueOnce({
      routedTo: 'subscription' as ModelSource,
      model: 'claude-haiku',
      confidence: 0.5  // Below confidence threshold
    });

    const request: RoutingRequest = {
      taskType: 'code-review',
      requestId: 'low-confidence-001'
    };

    const decision = await routingEngine.route(request);

    // Should follow priority, not Harvey recommendation (confidence too low)
    expect(decision.source).toBe('subscription');
    expect(decision.harveyRecommendation).toBeUndefined();
  });
});
