# Research Results: Model Cost Optimization

**Feature**: Model Cost Optimization
**Date**: 2026-10-28
**Spec**: [spec.md](spec.md)

## Overview

This document consolidates research findings for technical decisions needed to implement model cost optimization. Research focused on: (1) Claude subscription and API credits tracking APIs, (2) Harvey router integration patterns, (3) VS Code extension data storage best practices, and (4) routing record retention implementation.

## Research Tasks & Findings

### 1. Claude Subscription Usage Tracking

**Research Goal**: Identify how to track Claude.ai subscription usage and remaining quota for Pro/Max plans on a rolling window.

**Findings**:

**Decision**: Friday, October 28, 2026 - No Official Subscription API for Usage Tracking

Rationale:
- Claude.ai subscription usage data is not exposed via a public API for third-party applications
- Subscription plan details (Pro vs Max, rolling window limits) are documented at https://support.claude.com but must be manually configured by users
- The extension cannot programmatically query current subscription consumption without user-provided data

Alternatives Considered:
- **Anthropic API credits endpoint**: Accessible via authenticated API calls, but this only tracks API credit balance, not subscription usage
- **Web scraping**: Parsing claude.ai web UI - rejected due to fragility and Terms of Service violation risk
- **User manual tracking**: Asking users to manually update quota - rejected due to poor UX

**Selected Approach**: User-configured quota with optional manual updates

Implementation Strategy:
1. User configures their subscription plan type (Pro or Max) and rolling window dates in VS Code settings
2. Default plan limits (from https://support.claude.com) will be pre-populated but editable
3. Users can optionally provide quota usage values manually when limits approach
4. System correlates subscription vs API credit usage path based on Claude Code authentication method (detected via extension internal state)
5. When subscription quota cannot be tracked, system will prioritize subscription path until explicit API credit fallback requested

**Key Assumptions**:
- Claude Code internal authentication method detection is possible through existing adapter infrastructure
- Users will manually configure their plan details once during setup
- Plan documentation at https://support.claude.com will be kept up to date and can be referenced for default values

---

### 2. Harvey Router HTTP Service Integration

**Research Goal**: Understand Harvey router HTTP API endpoints, request/response format, and error handling patterns for Ollama routing decisions.

**Findings**:

**Decision**: Wednesday, October 27, 2026 - Use RESTful HTTP Client Pattern with Circuit Breaker Fallback

Rationale:
- Harvey runs as a separate local HTTP service (user confirmed clarification response)
- Need standard HTTP client patterns for reliability and timeout handling
- Circuit breaker prevents repeated calls to unhealthy Harvey instance
- Aligns with existing extension patterns (see `src/core/adapters/` modules)

Alternatives Considered:
- **gRPC**: Would require changing Harvey to expose gRPC endpoint - not feasible for external service
- **WebSocket**: Overkill for simple routing request/response; HTTP is sufficient
- **Embedded library**: Would violate separation of concerns with Harvey service - rejected per design

**Selected Approach**: HTTP POST to `/route decision endpoint` with circuit breaker

Implementation Strategy:
1. Create `ollama-adapter.ts` module (`src/core/routing/ollama-adapter.ts`)
2. Base URL configurable via VS Code settings (default: `http://localhost:11434`)
3. HTTP client uses Node.js built-in `fetch` (no new dependencies)
4. Circuit breaker pattern: open after 5 consecutive failures, half-open after 60s timeout
5. Request format (projected based on typical routing APIs):
   ```typescript
   {
     taskType: "code-review" | "test-generation" | "general" | "complex-analysis",
     metadata: { contextLength, features: ["language-detection"] },
     preference: "ollama-or-claude"
   }
   ```
6. Response format (projected):
   ```typescript
   {
     routedTo: "ollama" | "claude",
     model: string,
     confidence: number,
     reason?: string
   }
   ```
7. Error handling:
   - Connection refused → failover to Claude, set circuit breaker OPEN
   - Timeout (>200ms) → failover to Claude, log warning
   - 4xx errors → failover to Claude, log error details
   - 5xx errors → failover to Claude, increment circuit breaker

**Key Assumptions**:
- Harvey exposes RESTful endpoint(s) for routing decisions
- Harvey service runs on non-privileged port (user-configurable)
- Harvey can detect whether local Ollama models have required capabilities for tasks

**Open Questions for Implementation**:
- Exact Harvey endpoint path (to be discovered during implementation testing)
- Actual request/response schema (to be validated against running Harvey instance)
- Ollama availability checking mechanism (inline with request or separate health endpoint?)

---

### 3. VS Code Extension Data Storage for Routing Records

**Research Goal**: Determine best practices for storing routing decision records with 30-day retention and monthly rollups in VS Code extension context.

**Findings**:

**Decision**: Use GlobalStorage for Routing Records with Time-Based Partitioning

Rationale:
- VS Code `globalStorage` API is designed for extension-specific, machine-local data
- Data survives extension restarts and VS Code updates
- No SecretStorage needed (routing records are not sensitive)
- File-based storage allows efficient time-based querying and cleanup

Alternatives Considered:
- **workspace.getConfiguration**: Too limited for compact record storage; config is for small strings/numbers, not arrays of records
- **context.globalState**: In-memory persisted, but lacks file-level control for rotation/rollup operations
- **External database (SQLite)**: Unnecessary overhead; would violate Principle V (lightweight and simple)
- **Local files directly outside VS Code APIs**: Would bypass VS Code extension installation management - rejected

**Selected Approach**: GlobalStorage with partitioned records

Implementation Strategy:
1. Use `context.globalStorageUri` to get storage directory path
2. Store records as JSON files with partition structure:
   ```
   globalStorage/claude-switcher/routing-records/
   ├── daily/YYYY-MM-DD.json       # Daily detailed records (up to 30 files)
   └── monthly/YYYY-MM.json        # Monthly rollup summaries
   ```
3. Record format:
   ```typescript
   {
     id: string (UUID),
     timestamp: ISO 8601,
     routedTo: "subscription" | "api-credits" | "ollama",
     requestType: string,
     quotaBefore: number,
     quotaAfter: number,
     reason?: string
   }
   ```
4. Retention management:
   - On extension startup: delete daily files older than 30 days
   - Monthly: aggregate oldest daily records into rollups, then delete source files
   - Merge rollups into single JSON file per month
5. Query optimization:
   - Index by timestamp (file name partitioning provides O(1) lookup for date range)
   - Store as array of records in chronological order
   - Use streaming JSON parser for large files if needed (unlikely for 30-day quotas)

**Key Assumptions**:
- VS Code globalStorage has sufficient space for routing records (~1KB per record = ~30MB for 30,000 records/month)
- Extension startup performance not significantly impacted by retention management
- Users do not expect exportable/copyable routing records (local storage is sufficient)

---

### 4. Hybrid Routing Configuration Pattern

**Research Goal**: Design user-facing configuration model for hybrid routing (user-configured task type mappings + automatic detection fallback).

**Findings**:

**Decision**: Tiered Configuration with Explicit Warnings for Auto-Detection

Rationale:
- Explicit user control ensures predictable behavior (matches user's clarification: "C - should auto fail to local models if claudr is over budget also")
- Automatic detection handles novel task types without forcing user updates
- Configuration warnings prevent silent routing changes that could surprise users

Alternatives Considered:
- **Pure automatic detection**: Would be too opaque; users couldn't control routing for critical tasks
- **Pure explicit mapping**: Would require continuous maintenance for new task types, frustrating users
- **ML-based detection**: Overkill and introduces unnecessary complexity (violates YAGNI principle)

**Selected Approach**: Two-tier configuration

Implementation Strategy:
1. Configuration schema in VS Code settings:
   ```json
   {
     "claudeSwitcher.routing.priority": ["subscription", "api-credits", "ollama"],
     "claudeSwitcher.routing.taskMappings": {
       "code-review": "ollama",
       "test-generation": "ollama",
       "debugging": "subscription",
       "custom": "auto"
     },
     "claudeSwitcher.routing.autoFallback": true,
     "claudeSwitcher.routing.thresholds": {
       "subscriptionAlertPercent": 80,
       "subscriptionFallbackPercent": 100
     }
   }
   ```
2. Routing logic (in `routing-engine.ts`):
   - Step 1: Check user-configured mapping for task type → use explicit route
   - Step 2: If mapping is `auto` or task type not found → call Harvey for recommendation
   - Step 3: If Harvey unavailable and auto-mode → default to subscription
   - Step 4: If subscription exhausted AND `autoFallback` is true → default to Ollama (via Harvey)
3. Configuration validation on startup:
   - Warn if `ollama` is in priority list but Harvey not configured
   - Warn if task mappings reference unknown model sources
4. UI integration:
   - Settings page exposes task mapping editor (add/remove mappings)
   - Quick config wizard for first-time setup

**Key Assumptions**:
- Task types can be inferred from Claude Code request metadata (existing extension state machine may provide this)
- Harvey can provide recommendations when called without explicit task mapping
- Users understand the distinction between explicit mapping and auto-detection

---

## Recommendation Summary

Based on research findings, the implementation will:

1. **Subscription Usage**: Require user-manual configuration of plan limits, with optional manual quota updates. No official subscription API exists.

2. **Harvey Integration**: Use standard HTTP client with circuit breaker pattern. Endpoint and schema to be validated during implementation.

3. **Data Storage**: Use VS Code globalStorage with file-based partitioning (daily/monthly JSON files) for efficient retention management.

4. **Configuration**: Two-tier model (explicit mapping + automatic detection) with user-facing warnings.

**No unresolved NEEDS CLARIFICATION markers remain.** Proceed to Phase 1 design.
