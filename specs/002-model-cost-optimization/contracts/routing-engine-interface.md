# Routing Engine Interface Contract

**Feature**: Model Cost Optimization
**Contract Type**: Internal Module Interface
**Date**: 2026-10-28

## Overview

This contract defines the interface exposed by the Routing Engine (`src/core/routing/routing-engine.ts`) to other extension modules. The routing engine is responsible for determining which model source (subscription, API credits, or Ollama) should handle a given request based on configuration, quota state, and Harvey recommendations.

## Module Export

```typescript
// src/core/routing/routing-engine.ts
export interface IRoutingEngine {
  /**
   * Determine the routing decision for a request.
   *
   * @param request - Request context containing task type and metadata
   * @returns Routing decision with target source and optional reason
   * @throws RoutingError if no valid sources are available
   */
  route(request: RoutingRequest): Promise<RoutingDecision>;

  /**
   * Check if a routing path is available (has quota/credits).
   *
   * @param source - Model source to check
   * @returns true if source has remaining quota, false otherwise
   */
  isAvailable(source: ModelSource): Promise<boolean>;

  /**
   * Get current quota state for display/status bar.
   *
   * @returns Current quota snapshot (read-only)
   */
  getQuotaState(): QuotaSnapshot;

  /**
   * Manually trigger quota refresh (e.g., after user action).
   *
   */
  refreshQuota(): Promise<void>;

  /**
   * Reset routing history for testing/debugging.
   *
   * @internal exposed only for test utilities
   */
  resetHistory(): void;
}

// Re-export types for consumer convenience
export type { RoutingRequest, RoutingDecision, ModelSource, QuotaSnapshot };
```

## Data Types

### RoutingRequest

```typescript
interface RoutingRequest {
  /** Inferred task type (e.g., "code-review", "test-generation", "complex-analysis") */
  taskType: string;

  /** Optional context for routing heuristics */
  metadata?: {
    /** Estimated input/output tokens (if available from Claude Code state) */
    estimatedTokens?: number;

    /** Request urgency (user-triggered vs background) */
    urgency?: 'high' | 'normal' | 'low';

    /** Feature flags from user session */
    features?: string[];
  };

  /** Correlation ID for logging/tracking */
  requestId?: string;
}
```

### RoutingDecision

```typescript
interface RoutingDecision {
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
  timestamp: ISO 8601 string;
}

type ModelSource = 'subscription' | 'api-credits' | 'ollama';
```

### QuotaSnapshot

```typescript
interface QuotaSnapshot {
  subscription: {
    plan: 'pro' | 'max';
    dailyLimit: number;
    rollingWindowDays: number;
    currentUsage: number;
    remainingQuota: number;
    percentUsed: number;
    rollingWindowStart: ISO 8601 date string;
    rollingWindowEnd: ISO 8601 date string;
  };

  apiCredits: {
    balance: number;
    authenticated: boolean;
    lastFetchTime: Unix timestamp (ms);
  };

  ollama: {
    available: boolean;
    harveyReachable: boolean;
    circuitBreakerState: 'closed' | 'open' | 'half-open';
  };
}
```

## Behavior Contract

### Routing Decision Algorithm

The `route()` method MUST implement the following algorithm:

1. **Check explicit task mapping**:
   - Look up `taskType` in `taskMappings` configuration
   - If found (not `"auto"`):
     - Validate source is available (`isAvailable(source)`)
     - Return decision with source and reason `"User-configured mapping for ${taskType}"`

2. **Check Harvey recommendation** (if mapping is `"auto"` or task type not found):
   - If `"ollama"` in priority list and Harvey is reachable:
     - POST request to `harvey.baseUrl/route` with task type metadata
     - If recommended source is available:
       - Return decision with Harvey's source and reason `"Harvey recommendation for ${taskType}: ${model}"`

3. **Fallback to priority list**:
   - Iterate through `priority` array from configuration
   - For each source:
     - Check `isAvailable(source)`
     - If true: return decision with source and reason `"Priority fallback: ${source}`

4. **Auto-fallback rule** (per clarification answer 2):
   - If `autoFallback` is true and both subscription and API credits are exhausted:
     - If Ollama is available: route to Ollama
     - Reason: `"自动备份到本地 Ollama (Claude budgets exhausted)"`

5. **Error**:
   - If no valid sources available: throw `RoutingError` with message `"No available model sources: subscription exhausted, API credits exhausted, Ollama unavailable"`

### Quota Availability Check

The `isAvailable()` method MUST:

- For `subscription`: Check `SubscriptionQuotaState.remainingQuota > 0`
- For `api-credits`: Check `APICreditsBalance.balance > 0` AND `authenticated === true`
- For `ollama`: Check `harveyReachable === true` AND `circuitBreakerState !== 'open'`

### Error Handling

**RoutingError** (custom error type):

```typescript
class RoutingError extends Error {
  constructor(
    message: string,
    public readonly code: 'NO_AVAILABLE_SOURCES' | 'HARVEY_UNREACHABLE' | 'INVALID_CONFIGURATION'
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}
```

All methods MUST:
- Throw `RoutingError` with appropriate `code` for routing-specific failures
- Wrap network errors (Harvey, quota APIs) as `RoutingError` with `HARVEY_UNREACHABLE` or generic errors
- Never expose raw error messages to users (log internally instead)

## Performance Constraints

- `route()` MUST return within 200ms (per SC-003 clarification: quota checking adds <200ms latency)
- `isAvailable()` MUST return within 50ms (in-memory cache lookup)
- `refreshQuota()` SHOULD return within 1s (network request to quota APIs)

## Logging Contract

All routing decisions MUST be logged via `logger`:
- Log level: `info` for successful routing
- Log level: `warn` for fallback to secondary sources
- Log level: `error` for routing failures

Log format: JSON with fields:
```typescript
{
  correlationId: string,
  taskId: string,
  routedTo: ModelSource,
  taskType: string,
  reason: string,
  latencyMs: number,
  timestamp: ISO 8601 string
}
```

## Testing Contract

Unit tests MUST verify:

1. **Explicit mapping routing**: Task types with configured mappings route correctly
2. **Harvey recommendation routing**: Auto-detect tasks route via Harvey recommendations
3. **Priority fallback routing**: Exhausted subscription falls back to API credits
4. **Auto-fallback to Ollama**: Claude exhaustion triggers Ollama when `autoFallback` is true
5. **Circuit breaker handling**: Harvey failures trigger fallback and circuit breaker state changes
6. **Quota exhaustion**: All sources exhausted throws `RoutingError.NO_AVAILABLE_SOURCES`
7. **Performance compliance**: `route()` <200ms for happy path

Integration tests MUST verify:

1. **End-to-end routing**: From request to decision to routing record write
2. **Configuration changes**: Priority/mapping changes take effect immediately
3. **Concurrent requests**: Multiple simultaneous requests handle quota state correctly
4. **Status bar updates**: Quota snapshot reflects current state

## Future Extensions (Reservations)

This contract reserves the right to add capabilities without breaking changes:

- Additional routing heuristics (e.g., cost-aware routing, latency-aware routing)
- More sophisticated Harvey response handling (multiple recommended models)
- Quota prediction features (forecast exhaustion date)
- Bulk routing decisions for batch operations
