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
import { OllamaAdapter } from './ollama-adapter';
import type { HarveyRecommendation } from './ollama-adapter';
import type { RoutingHistoryManager } from './routing-history';

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
    autoFallbackTriggered: boolean;
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
  private ollamaAdapter: OllamaAdapter | null = null;
  private routingHistory: RoutingHistoryManager | null = null;

  constructor(
    config: RoutingConfiguration,
    quotaCache: QuotaCache,
    routingHistory?: RoutingHistoryManager
  ) {
    this.config = config;
    this.quotaCache = quotaCache;

    // Initialize Ollama adapter if Harvey is in priority or auto-fallback is enabled
    if (config.priority.includes('ollama') || config.autoFallback) {
      this.ollamaAdapter = new OllamaAdapter(config.harvey.baseUrl);
    }

    // Store routing history manager if provided
    this.routingHistory = routingHistory ?? null;
  }

  async route(request: RoutingRequest): Promise<RoutingDecision> {
    const startTime = performance.now();
    let harveyRecommendation: HarveyRecommendation | null = null;

    // Step 1: Check taskMappings config for explicit route
    const explicitRoute = this.config.taskMappings[request.taskType];
    if (explicitRoute && explicitRoute !== 'auto') {
      // Measure quota check latency specifically
      const quotaCheckStart = performance.now();
      const isAvailable = await this.isAvailable(explicitRoute);
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (isAvailable) {
        const decision = {
          source: explicitRoute,
          reason: `Explicit mapping for task type '${request.taskType}' to ${explicitRoute}`,
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          }
        };

        // T035: Write routing decision to history
        await this.writeDecisionToHistory(decision, request.taskType, request.requestId);

        return decision;
      }

      // Continue to fallback logic if explicit route not available
    }

    // Step 2: Harvey recommendation (T047)
    // Call Harvey for recommendation only when task mapping is 'auto' OR when no mapping exists and ollama is in priority
    const shouldCallHarvey: boolean =
      !!this.ollamaAdapter &&
      (this.config.taskMappings[request.taskType] === 'auto' ||
        (this.config.taskMappings[request.taskType] === undefined &&
         this.config.priority.includes('ollama')));

    if (shouldCallHarvey) {
      try {
        harveyRecommendation = await this.ollamaAdapter!.getRecommendation(request.taskType, 200);

        // Update Ollama state based on Harvey availability
        this.quotaCache.ollama.harveyReachable = true;
        this.quotaCache.ollama.circuitBreakerState = this.ollamaAdapter!.getCircuitBreakerState();
      } catch (error) {
        // Harvey unreachable, update circuit breaker state
        if (error instanceof RoutingError && error.code === 'HARVEY_UNREACHABLE') {
          this.quotaCache.ollama.harveyReachable = false;
          this.quotaCache.ollama.circuitBreakerState = this.ollamaAdapter?.getCircuitBreakerState() ?? 'open';
        }
        // Continue to fallback logic
      }
    }

    // Step 3: Build priority array, influenced by Harvey recommendation if available
    let priority = this.config.priority || ['subscription', 'api-credits', 'ollama'];

    // If Harvey recommends a source and has high confidence, prioritize it first
    if (harveyRecommendation?.routedTo && harveyRecommendation.confidence && harveyRecommendation.confidence >= 0.7) {
      const recommendedSource: ModelSource = harveyRecommendation.routedTo;
      // Remove recommended source from its original position and add to front
      priority = [recommendedSource, ...priority.filter(s => s !== recommendedSource)];
    }

    // Step 4: Check each source in priority order, return first available
    for (const source of priority) {
      // Measure quota check latency specifically
      const quotaCheckStart = performance.now();
      const isAvailable = await this.isAvailable(source);
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (isAvailable) {
        const decision = {
          source,
          reason: `Priority fallback: ${source}`,
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          },
          harveyRecommendation: undefined as { model: string; confidence: number } | undefined
        };

        // Attach Harvey recommendation if available
        if (harveyRecommendation?.model && harveyRecommendation.confidence !== undefined) {
          decision.harveyRecommendation = {
            model: harveyRecommendation.model,
            confidence: harveyRecommendation.confidence
          };
        }

        // T035: Write routing decision to history
        await this.writeDecisionToHistory(decision, request.taskType, request.requestId);

        return decision;
      }
    }

    // Step 5: Auto-fallback to Ollama (T048)
    // If all sources exhausted and auto-fallback enabled, try Ollama
    if (
      this.config.autoFallback &&
      this.quotaCache.subscription.remainingQuota <= 0 &&
      this.quotaCache.apiCredits.balance <= 0
    ) {
      const quotaCheckStart = performance.now();
      const ollamaAvailable = await this.isAvailable('ollama');
      const quotaCheckLatency = performance.now() - quotaCheckStart;

      if (ollamaAvailable) {
        const decision: RoutingDecision = {
          source: 'ollama',
          reason: 'Auto-fallback to local Ollama (Claude budgets exhausted)',
          timestamp: new Date().toISOString(),
          performance: {
            latencyMs: performance.now() - startTime,
            quotaCheckLatencyMs: quotaCheckLatency
          }
        };

        // T048: Set auto-fallback triggered flag
        this.quotaCache.ollama.autoFallbackTriggered = true;

        // T035: Write routing decision to history
        await this.writeDecisionToHistory(decision, request.taskType, request.requestId);

        return decision;
      }
    }

    // Step 6: No sources available - throw error
    throw new RoutingError(
      'No available model sources: subscription exhausted, API credits exhausted, Ollama unavailable',
      'NO_AVAILABLE_SOURCES'
    );
  }

  /**
   * Write routing decision to history (T035)
   *
   * Converts routing-engine RoutingDecision to routing-history RoutingDecision
   * and persists to global storage.
   */
  private async writeDecisionToHistory(
    decision: RoutingDecision,
    taskType: string,
    requestId?: string
  ): Promise<void> {
    if (!this.routingHistory) {
      return;
    }

    // Get before/after quota values
    const quotaBefore = this.quotaCache.subscription.currentUsage;
    const quotaAfter = quotaBefore + 1; // Assuming increment by 1 per request

    try {
      // Convert routing-engine decision to routing-history format
      await this.routingHistory.writeDecision({
        routedTo: decision.source,
        taskType,
        requestId,
        quotaBefore,
        quotaAfter,
        reason: decision.reason,
        performance: decision.performance
      });
    } catch (error) {
      // Log error but don't fail the routing decision
      console.error('Failed to write routing decision to history:', error);
    }
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
        return (
          this.quotaCache.ollama.available &&
          this.quotaCache.ollama.harveyReachable &&
          this.quotaCache.ollama.circuitBreakerState !== 'open'
        );

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
        circuitBreakerState: this.quotaCache.ollama.circuitBreakerState,
        autoFallbackTriggered: this.quotaCache.ollama.autoFallbackTriggered
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
