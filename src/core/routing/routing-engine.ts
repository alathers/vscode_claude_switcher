/**
 * Routing Engine - Core routing decision logic
 *
 * Determines which model source (subscription, API credits, or Ollama) should
 * handle a given request based on configuration, quota state, and Harvey recommendations.
 *
 * This is a pure logic module with no vscode imports (Principle IV) for testability.
 */

import type { RoutingConfiguration } from './routing-config';
import type { QuotaCache } from '../quota/quota-cache';

/**
 * Model source options
 */
export type ModelSource = 'subscription' | 'api-credits' | 'ollama';

/**
 * Routing request context
 */
export interface RoutingRequest {
  /** Inferred task type */
  taskType: string;

  /** Optional context for routing heuristics */
  metadata?: {
    estimatedTokens?: number;
    urgency?: 'high' | 'normal' | 'low';
    features?: string[];
  };

  /** Correlation ID for logging/tracking */
  requestId?: string;
}

/**
 * Routing decision
 */
export interface RoutingDecision {
  /** Selected model source */
  source: ModelSource;

  /** Human-readable reason for routing decision */
  reason: string;

  /** Harvey recommendation (if applicable) */
  harveyRecommendation?: {
    model: string;
    confidence: number;
  };

  /** Performance metrics */
  performance?: {
    latencyMs: number;
    quotaCheckLatencyMs: number;
  };

  /** Timestamp when decision was made */
  timestamp: string; // ISO 8601 string
}

/**
 * Quota snapshot for display/status bar
 */
export interface QuotaSnapshot {
  subscription: {
    plan: 'pro' | 'max';
    dailyLimit: number;
    rollingWindowDays: number;
    currentUsage: number;
    remainingQuota: number;
    percentUsed: number;
    rollingWindowStart: string;
    rollingWindowEnd: string;
  };

  apiCredits: {
    balance: number;
    authenticated: boolean;
    stale: boolean;
    lastFetchTime: number;
  };

  ollama: {
    available: boolean;
    harveyReachable: boolean;
    circuitBreakerState: 'closed' | 'open' | 'half-open';
  };
}

/**
 * Routing error
 */
export class RoutingError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_AVAILABLE_SOURCES' | 'HARVEY_UNREACHABLE' | 'INVALID_CONFIGURATION'
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

/**
 * Routing engine interface
 */
export interface IRoutingEngine {
  /**
   * Determine the routing decision for a request
   */
  route(request: RoutingRequest): Promise<RoutingDecision>;

  /**
   * Check if a routing path is available (has quota/credits)
   */
  isAvailable(source: ModelSource): Promise<boolean>;

  /**
   * Get current quota state for display/status bar
   */
  getQuotaState(): QuotaSnapshot;

  /**
   * Manually trigger quota refresh
   */
  refreshQuota(): Promise<void>;

  /**
   * Reset routing history for testing/debugging
   */
  resetHistory(): void;
}

/**
 * Routing Engine Implementation
 *
 * Pure logic module for routing decisions based on quota state and configuration.
 */
export class RoutingEngine implements IRoutingEngine {
  private config: RoutingConfiguration;
  private quotaCache: QuotaCache;

  constructor(
    config: RoutingConfiguration,
    quotaCache: QuotaCache
  ) {
    this.config = config;
    this.quotaCache = quotaCache;
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = performance.now();

    // Step 1: Check taskMappings config for explicit route
    const explicitRoute = this.config.taskMappings[request.taskType];
    if (explicitRoute && explicitRoute !== 'auto') {
      // Measure quota check latency specifically
      const quotaCheckStart = performance.now();
      const isAvailable = await this.isAvailable(explicitRoute);
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (isAvailable) {
        return {
          source: explicitRoute,
          reason: `Explicit mapping for task type '${request.taskType}' to ${explicitRoute}`,
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          }
        };
      }
    }

    // Step 2 & 3: Harvey recommendation (skipped for US3, US4)
    // Fallback to priority array from config
    const priority = this.config.priority || ['subscription', 'api-credits', 'ollama'];

    // Step 4 & 5: Check each source in priority order, return first available
    for (const source of priority) {
      // Measure quota check latency specifically
      const quotaCheckStart = performance.now();
      const isAvailable = await this.isAvailable(source);
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (isAvailable) {
        return {
          source,
          reason: `Priority fallback: ${source}`,
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          }
        };
      }
    }

    // Step 6: No sources available - throw error
    throw new RoutingError(
      'No available model sources: subscription exhausted, API credits exhausted, Ollama unavailable',
      'NO_AVAILABLE_SOURCES'
    );
  }

  async isAvailable(source: ModelSource): Promise<boolean> {
    switch (source) {
      case 'subscription':
        return this.quotaCache.subscription.remainingQuota > 0;

      case 'api-credits':
        return (
          this.quotaCache.apiCredits.balance > 0 &&
          this.quotaCache.apiCredits.authenticated
        );

      case 'ollama':
        return this.quotaCache.ollama.available;

      default:
        return false;
    }
  }

  getQuotaState(): QuotaSnapshot {
    return {
      subscription: {
        plan: this.quotaCache.subscription.plan,
        dailyLimit: this.quotaCache.subscription.dailyLimit,
        rollingWindowDays: this.quotaCache.subscription.rollingWindowDays,
        currentUsage: this.quotaCache.subscription.currentUsage,
        remainingQuota: this.quotaCache.subscription.remainingQuota,
        percentUsed: this.quotaCache.subscription.percentUsed,
        rollingWindowStart: this.quotaCache.subscription.rollingWindowStart,
        rollingWindowEnd: this.quotaCache.subscription.rollingWindowEnd
      },
      apiCredits: {
        balance: this.quotaCache.apiCredits.balance,
        authenticated: this.quotaCache.apiCredits.authenticated,
        stale: this.quotaCache.apiCredits.stale,
        lastFetchTime: this.quotaCache.apiCredits.lastFetchTime
      },
      ollama: {
        available: this.quotaCache.ollama.available,
        harveyReachable: this.quotaCache.ollama.harveyReachable,
        circuitBreakerState: this.quotaCache.ollama.circuitBreakerState
      }
    };
  }

  async refreshQuota(): Promise<void> {
    // TODO: Implement quota refresh logic
    // This will involve calling quota provider to fetch updated subscription usage and API credits balance
  }

  resetHistory(): void {
    // TODO: Implement routing history reset for testing/debugging
  }
}
