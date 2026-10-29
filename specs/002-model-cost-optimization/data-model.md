# Data Model: Model Cost Optimization

**Feature**: Model Cost Optimization
**Date**: 2026-10-28

## Overview

This document defines the core data entities, their attributes, relationships, and validation rules for the model cost optimization feature. Separates concerns between configuration state, runtime tracking, and historical records.

## Core Entities

### 1. RoutingConfiguration

**Purpose**: Stores user preferences for model routing priorities and fallback behavior.

**Location**: VS Code Configuration (`workspace.getConfiguration('claudeSwitcher.routing')`)

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `priority` | `array` of strings | Yes | `["subscription", "api-credits", "ollama"]` | Ordered list of model sources to try. First non-exhausted source is used. Valid values: `"subscription"`, `"api-credits"`, `"ollama"`. |
| `taskMappings` | `object` (map) | No | `{}` | Maps task type strings to specific model sources. Keys are task types (`"code-review"`, `"test-generation"`, etc.), values are model source strings. Special value `"auto"` triggers Harvey recommendation. |
| `autoFallback` | `boolean` | Yes | `true` | If `true`, automatically falls back to Ollama when both subscription and API credits are exhausted (per clarification answer 2). |
| `thresholds.subscriptionAlertPercent` | `number` | Yes | `80` | Percentage of subscription quota used that triggers a notification to the user (0-100 range). |
| `thresholds.subscriptionFallbackPercent` | `number` | Yes | `100` | Percentage of subscription quota used that switches routing to API credits (0-100 range). |
| `harvey.baseUrl` | `string` (URI) | No (if `"ollama"` not in priority) | `"http://localhost:11434"` | Base URL for Harvey router HTTP service. Must be valid URI. |
| `subscription.plan` | `string` | Yes (user-configured) | `"pro"` | User's subscription plan type: `"pro"` or `"max"`. Plans document rolling window limits (see Claude support site). |
| `subscription.dailyLimit` | `number` | Yes (user-configured) | `30` | Daily message limit for user's plan (from https://support.claude.com). Defaults may change; users should verify current limits. |
| `subscription.rollingWindowDays` | `number` | Yes | `7` | Rolling window duration in days for quota calculations (Pro=7, Max=14 per Claude documentation). |

**Validation Rules**:

1. `priority` array:
   - Must contain at least one valid model source
   - Cannot contain duplicates
   - If `"ollama"` is present, `harvey.baseUrl` must be non-empty and valid URI

2. `taskMappings` object:
   - Keys must be non-empty strings
   - Values must be one of: `"subscription"`, `"api-credits"`, `"ollama"`, `"auto"`

3. `thresholds`:
   - `subscriptionAlertPercent` must be in range [0, 100]
   - `subscriptionFallbackPercent` must be in range [0, 100]
   - `subscriptionFallbackPercent` must be ≥ `subscriptionAlertPercent`

4. `harvey.baseUrl`:
   - If `"ollama"` in `priority`, must be valid HTTP/HTTPS URI
   - Scheme must be `http` or `https` (local service)
   - Hostname must not be `~` (tilde) or contain spaces

5. `subscription` fields:
   - `plan` must be `"pro"` or `"max"`
   - `dailyLimit` must be positive number > 0
   - `rollingWindowDays` must be positive number > 0

---

### 2. SubscriptionQuotaState

**Purpose**: Runtime state tracking Claude subscription usage and remaining quota for the rolling window.

**Location**: In-memory cache (`src/core/quota/quota-cache.ts`)

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `plan` | `string` | Yes | `"pro"` | Current subscription plan (from configuration). |
| `dailyLimit` | `number` | Yes | computed | Daily message limit (from configuration). |
| `rollingWindowDays` | `number` | Yes | computed | Rolling window duration (from configuration). |
| `rollingWindowStart` | `ISO 8601 date string` | Yes | computed today | Start date of current rolling window (recalculated each session startup). |
| `rollingWindowEnd` | `ISO 8601 date string` | Yes | computed in N days | End date of current rolling window (`rollingWindowStart + N days`). |
| `currentUsage` | `number` | Yes | `0` | Number of messages used in current rolling window. |
| `remainingQuota` | `number` | Yes | computed | `dailyLimit * rollingWindowDays - currentUsage` |
| `percentUsed` | `number` | Yes | computed | `(currentUsage / (dailyLimit * rollingWindowDays)) * 100` |
| `lastFetchTime` | `Unix timestamp (ms)` | Yes | now | Timestamp when quota data was last refreshed. |
| `stale` | `boolean` | Yes | `false` | Flag indicating cache is stale (>60 seconds old). |

**Validation Rules**:

1. `currentUsage` cannot exceed `dailyLimit * rollingWindowDays`
2. `remainingQuota` cannot be negative
3. `percentUsed` clamped to [0, 100]
4. `rollingWindowStart` and `rollingWindowEnd` form valid date range

**State Transitions**:

| Event | State Change |
|-------|--------------|
| Extension starts | Initialize `rollingWindowStart` to today, reset `currentUsage` to 0 |
| Subscription request routed | Increment `currentUsage`, recalculate `remainingQuota` |
| Rolling window expires | Reset `currentUsage` to 0, advance `rollingWindowStart` |
| Manual quota update (user input) | Set `currentUsage` to user value, recalculate derived fields |

---

### 3. APICreditsBalance

**Purpose**: Tracks prepaid API credit balance for fallback usage.

**Location**: In-memory cache (`src/core/quota/quota-cache.ts`)

**Fields**:

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `balance` | `number` | Yes | `Infinity` | Current API credit balance in tokens or credits. `Infinity` means unlimited/unknown. |
| `lastFetchTime` | `Unix timestamp (ms)` | Yes | now | Timestamp when balance was last checked. |
| `stale` | `boolean` | Yes | `false` | Flag indicating balance is stale (>60 seconds old). |
| `authenticated` | `boolean` | Yes | `false` | Whether user has API key configured (checked in SecretStorage). |

**Validation Rules**:

1. `balance` cannot be negative
2. If `authenticated` is `false`, `balance` is effectively `Infinity` (no API fallback available)

**State Transitions**:

| Event | State Change |
|-------|--------------|
| Extension starts | Read API key from SecretStorage, set `authenticated`, fetch initial `balance` |
| API request routed | Decrement `balance` by estimated tokens (if tracking) |
| API rate limit reached | Set `balance` to `0` |
| User adds API key | Set `authenticated` to `true`, fetch `balance` |

---

### 4. RoutingDecision (Record)

**Purpose**: Historical record of routing decision metadata for cost analysis and debugging. Stored for 30 days, then monthly rollups.

**Location**: GlobalStorage (`context.globalStorageUri/routing-records/daily/YYYY-MM-DD.json`)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string (UUID v4)` | Yes | Unique identifier for this decision (correlates logs). |
| `timestamp` | `ISO 8601 datetime string` | Yes | When routing decision was made (UTC). |
| `routedTo` | `enum` | Yes | Model source selected: `"subscription"`, `"api-credits"`, `"ollama"`. |
| `taskType` | `string` | Yes | Task type inferred or configured (`"code-review"`, `"test-generation"`, `"general"`, `"complex-analysis"`, `"custom"`). |
| `requestId` | `string` | No | Correlation with Claude Code request (if available). |
| `quotaBefore` | `number` | No | Subscription quota/credits before this request (if applicable). |
| `quotaAfter` | `number` | No | Subscription quota/credits after this request (if applicable). |
| `reason` | `string` | Yes | Human-readable explanation: `"User-configured mapping"`, `"Harvey recommendation"`, `"自动备份到本地 Ollama (Claude budgets exhausted)"`, `"Harvey unreachable, using Claude"`. |
| `performance` | `object` | No | Optional performance metrics (for debugging): `{`latency`: number, `circuitBreakerState`: string}` |

**Validation Rules**:

1. `id` must be valid UUID v4 format
2. `timestamp` must be valid ISO 8601 datetime
3. `routedTo` must be one of enum values
4. `quotaAfter` cannot be less than `quotaBefore` (should reflect consumption, not error states)

**Storage Pattern**:

```json
{
  "records": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "timestamp": "2026-10-28T14:32:10Z",
      "routedTo": "ollama",
      "taskType": "code-review",
      "quotaBefore": null,
      "quotaAfter": null,
      "reason": "Harvey recommendation for code-review task",
      "performance": {"latency": 145, "circuitBreakerState": "closed"}
    }
    // ... more records for the day
  ]
}
```

---

### 5. MonthlyRollup

**Purpose**: Aggregated summary of routing records for historical cost analysis. Generated from daily records after 30 days.

**Location**: GlobalStorage (`context.globalStorageUri/routing-records/monthly/YYYY-MM.json`)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `month` | `YYYY-MM` | Yes | Month identifier. |
| `totalRequests` | `number` | Yes | Total routing decisions made in month. |
| `usageBySource` | `object` | Yes | Per-model-source counts: `{`subscription`: N, `api-credits`: N, `ollama`: N}`. |
| `usageByTaskType` | `object` | Yes | Per-task-type counts: `{`code-review`: N, `test-generation`: N, ...}`. |
| `totalLatencyMs` | `number` | Yes | Sum of all routing decision latencies (for average calculation). |
| `averageLatencyMs` | `number` | Yes | `totalLatencyMs / totalRequests` |

**Validation Rules**:

1. `totalRequests` must equal sum of all `usageBySource` values
2. All counts must be non-negative

---

## Entity Relationships

```
RoutingConfiguration (VS Code Settings)
│
├─┬> configures ──┐
│ │               │
│ │             SubscriptionQuotaState (In-Memory Cache)
│ │               │
│ └──────────────> APICreditsBalance (In-Memory Cache)
│                   (both use thresholds and priority from config)
│
└─┬> writes to ── RoutingDecision (GlobalStorage)
  │                (30-day retention)
  │
  └┬> aggregates to ── MonthlyRollup (GlobalStorage)
                   (monthly rollups)
```

**Reading direction**: Arrow source → arrow target
- Writes: Configuration drives quota state updates
- Writes: Routing engine creates Decision records using quota state
- Aggregates: Decisions roll up to Monthly

---

## Data Flow Summary

1. **Configuration Load**: Extension starts → Load `RoutingConfiguration` from settings
2. **Quota Initialization**: Based on `RoutingConfiguration`, initialize `SubscriptionQuotaState` and `APICreditsBalance`
3. **Routing Decision**:
   a. Request arrives with inferred task type
   b. Check `RoutingConfiguration.taskMappings` for explicit route → if found, use it
   c. If not found or `"auto"`, call Harvey for recommendation
   d. If Harvey unavailable, check `RoutingConfiguration.priority` for fallback
   e. Validate quota (`SubscriptionQuotaState.remainingQuota > 0` or `APICreditsBalance.balance > 0`)
   f. Update quota state
   g. Write `RoutingDecision` record to GlobalStorage
4. **Retention**: Background task runs periodically → aggregates 30-day-old `RoutingDecision`s → writes `MonthlyRollup` → deletes daily files
