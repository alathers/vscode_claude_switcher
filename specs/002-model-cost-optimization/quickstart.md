# Quickstart Validation Guide: Model Cost Optimization

**Feature**: Model Cost Optimization
**Purpose**: Validate end-to-end feature functionality before committing implementation
**Date**: 2026-10-28

## Overview

This guide provides runnable validation scenarios to verify the Model Cost Optimization feature works as specified. Each scenario includes prerequisites, setup steps, test commands, and expected outcomes.

## Prerequisites

1. **VS Code Extension Environment**:
   ```bash
   # Install extension in development mode
   cd /Users/alathers/src/alathers/vscode_claude_switcher
   npm install
   npm run compile
   code --install-extension out/claude-switcher-*.vsix
   ```

2. **Harvey Router Service** (if testing Ollama routing):
   ```bash
   # Start Harvey (adjust command based on Harvey installation)
   harvey serve --port 11434
   ```

3. **Test Data**: Mock quota data for subscription/API credits (or use real Claude Code session configuration)

---

## Validation Scenario 1: Subscription-First Routing

**Success Criteria**: FR-002, FR-005, SC-001

### Prerequisites

- extension loaded in VS Code
- Default configuration (subscription first priority)

### Setup

1. Open VS Code Settings: `Cmd+,` (macOS) or `Ctrl+,` (Windows/Linux)
2. Search for: `@ext:claude-switcher routing`
3. Verify default configuration:
   - `priority`: `["subscription", "api-credits", "ollama"]`
   - `subscription.plan`: `"pro"`
   - `subscription.dailyLimit`: `30`

### Test Steps

1. **Open status bar widget**
   ```
   Command Palette → "Claude Switcher: Show Quota Dashboard"
   Expected: Webview opens showing current subscription quota and status
   ```

2. **Verify priority respects configuration**
   ```
   Command Palette → Run a Claude Code request (e.g., code review)
   Expected: Status bar shows "🎯 Sub: X% | API: ∞ | 🦙 Ollama"
   (Sub counter increments; request routed to subscription)
   ```

3. **Test configuration change**
   ```
   Settings → Change `priority` to `["api-credits", "subscription"]`
   Command Palette → Run another Claude Code request
   Expected: Status bar shows routing to API credits (auth required)
   ```

### Expected Outcomes

- ✅ Configuration editor loads within 2 seconds (SC-001)
- ✅ Status bar widget always visible and updates in real-time (Principle II)
- ✅ Requests route according to `priority` array (FR-002)
- ✅ Manual quota reset works (optional test):
  ```
  Command Palette → "Claude Switcher: Reset Quota Tracking"
  Expected: Confirmation dialog → quota counter resets to 0
  ```

---

## Validation Scenario 2: Subscription Exhaustion → API Credits Fallback

**Success Criteria**: FR-005, FR-006, SC-002, SC-003

### Prerequisites

- Extension running
- API credits configured (API key in SecretStorage)
- Subscription quota by necessity manually set to exhausted state for testing

### Setup

```
# Manually exhaust subscription for testing
Command Palette → Run: "Claude Switcher: Reset Quota Tracking"
Command Palette → Run: "Claude Switcher: Show Quota Dashboard"
# In webview: manually set currentUsage = dailyLimit * rollingWindowDays (or use test utility)
```

### Test Steps

1. **Trigger automatic fallback**
   ```
   Command Palette → Run Claude Code request (e.g., code review)
   Expected: Notification appears: "Routing change: subscription exhausted → API credits"
            Status bar changes to: "❌ Sub: 100% → API"
            Request completes successfully via API credits
   ```

2. **Verify quota transition without interruption**
   ```
   Repeat: Run 5 more requests in quick succession
   Expected: All 5 requests succeed (95% uptime SC-002)
            Fallback notification shows only once (not per-request)
            Transition latency <1s (SC-003)
   ```

3. **Verify routing adaptation timestamp**
   ```
   Command Palette → "Claude Switcher: Show Quota Dashboard"
   Expected: Dashboard shows routing transition timestamp
            Color-coding: red for exhausted, green for active
   ```

### Expected Outcomes

- ✅ Fallback to API credits occurs automatically without user intervention (FR-005)
- ✅ User notification clearly indicates routing change + reason (FR-006)
- ✅ No request failures during transition (95% uptime SC-002)
- ✅ Routing adapts within 1 second when limit reached (SC-003)
- ✅ Quota checking adds <200ms latency per request (clarified SC-003)

---

## Validation Scenario 3: Ollama Routing via Harvey

**Success Criteria**: FR-007, FR-011, FR-013, SC-005

### Prerequisites

- Harvey router service running on `http://localhost:11434`
- At least one Ollama model pulled (e.g., `ollama pull llama3.2`)
- Extension configured with `ollama` in priority list

### Setup

```
# Start Harvey
harvey serve --port 11434

# Verify Harvey is reachable
Command Palette → "Claude Switcher: Validate Harvey Connection"
Expected: Success message "Harvey service reachable and responding"

# Ensure task mappings include ollama
Settings → Set taskMappings: { "code-review": "ollama" }
```

### Test Steps

1. **Test explicit mapping routing**
   ```
   Command Palette → Run Claude Code request for code-review task
   Expected: Status bar shows "🦙 Ollama" (not subscription/API)
            Request completes through Ollama model
            Logger confirms routing via Harvey
   ```

2. **Test auto-detection fallback**
   ```
   Settings → Set taskMappings: { "complex-analysis": "auto" }
   Command Palette → Run complex-analysis request
   Expected: Harvey receives request and returns recommendation
            Status bar reflects Harvey's routing decision
            If Harvey unavailable → automatic fallback to Claude
   ```

3. **Test Harvey unreachable handling**
   ```
   # Stop Harvey service
   Ctrl+C to stop Harvey process

   Command Palette → Run code-review request
   Expected: Graceful fallback to Claude subscription
            Notification: "Harvey unreachable, using Claude"
            Circuit breaker state shows OPEN (checked in dashboard)
   ```

4. **Test Harvey recovery**
   ```
   # Restart Harvey
   harvey serve --port 11434

   Command Palette → "Claude Switcher: Validate Harvey Connection"
   Expected: Connection accepted (circuit breaker transitions to HALF-OPEN)

   Command Palette → Run code-review request
   Expected: Routing restored to Ollama after successful Harvey response
            Circuit breaker state returns to CLOSED
   ```

### Expected Outcomes

- ✅ Requests route to Ollama when configured (FR-007)
- ✅ Harvey unreachable triggers graceful Claude fallback (FR-011)
- ✅ Quota checking adds <200ms latency (per research)
- ✅ Ollama routing reduces costs (measure cost reduction vs. API credits baseline)
  - Run 50 requests via Claude API → record token cost
  - Rerun same 50 requests via Ollama → record (near-zero) cost
  - Expected: ≥30% cost reduction (SC-005)

---

## Validation Scenario 4: Auto-Fallback to Ollama (Claude Budgets Exhausted)

**Success Criteria**: Clarification Answer 2 (Q2 response: Hybrid + auto-fallback)

### Prerequisites

- Subscription exhausted (as in Scenario 2)
- API credits exhausted (simulate by setting `balance: 0`)
- Ollama configured and Harvey reachable

### Setup

```
# Exhaust both subscription and API credits
Settings → Set subscription.currentUsage = dailyLimit * rollingWindowDays
Settings → Set apiCredits.balance = 0

# Enable auto-fallback
Settings → autoFallback = true
```

### Test Steps

```
Command Palette → Run Claude Code request (any task type)
Expected: Routing to Ollama automatically触发 (no user intervention needed)
            Status bar: "🦙 Ollama (auto-fallback: Claude exhausted)"
            Request completes successfully through local model
            Reason logged: "自动备份到本地 Ollama (Claude budgets exhausted)"
```

### Expected Outcomes

- ✅ Both subscription and API credits exhausted → automatic Ollama routing (per Q2)
- ✅ Works for all task types (not just configured mappings)
- ✅ User notification clarifies auto-fallback reason
- ✅ No user intervention required (automatic adaptation per user requirement)

---

## Validation Scenario 5: Configuration Validation

**Success Criteria**: FR-001, FR-009

### Prerequisites

- Extension loaded

### Test Steps

1. **Validate valid configuration**
   ```
   Settings → Set all fields per configuration contract (see contracts/configuration.md)
   Expected: No error messages (configuration saves successfully)
   ```

2. **Validate invalid dependency**
   ```
   Settings → Set priority to ["subscription", "ollama"]
   Settings → Set harvey.baseUrl = "" (empty string)
   Expected: Warning notification: "Invalid configuration: ollama in priority but Harvey not configured"
   ```

3. **Validate threshold order**
   ```
   Settings → Set thresholds.subscriptionAlertPercent = 90
   Settings → Set thresholds.subscriptionFallbackPercent = 80
   Expected: Warning notification: "Invalid configuration: Fallback threshold (80%) must be ≥ alert threshold (90%)"
   ```

4. **Validate configuration persistence**
   ```
   Settings → Modify any routing configuration field
   Restart VS Code
   Expected: Configuration reloaded correctly (no reset to defaults)
            Extension startup shows configured state
   ```

### Expected Outcomes

- ✅ Configuration UI available within 2 seconds (SC-001)
- ✅ Invalid configurations logged as warnings but don't prevent startup
- ✅ Valid configurations persist across extension restarts (FR-009)
- ✅ Dependency validation prevents routing to unavailable sources

---

## Validation Scenario 6: Routing History and Records

**Success Criteria**: Data Model (RoutingDecision, MonthlyRollup), Retention policy (Q1)

### Prerequisites

- Extension running
- At least 10 requests made (via Scenarios 1-4)

### Test Steps

1. **View routing history in dashboard**
   ```
   Command Palette → "Claude Switcher: Show Quota Dashboard"
   Expected: Dashboard shows list of recent routing decisions (last 10)
            Each record shows: timestamp, routedTo, taskType, reason
   ```

2. **Export history**
   ```
   Command Palette → "Claude Switcher: Export Routing History"
   Expected: File save dialog opens
            After saving: File contains JSON array of all routing records
            Records include: id, timestamp, routedTo, taskType, reason, quotaBefore/After
   ```

3. **Verify record retention** (long-running test, optional)
   ```
   # Run extension for 30+ days or simulate time change
   Check: GlobalStorage directory (see VS Code → Developer → Show Data Path)
   Expected: Daily JSON files up to 30 days old exist
            Older daily files deleted
            Monthly rollup JSON files exist for aggregated months
   ```

### Expected Outcomes

- ✅ Routing records written to GlobalStorage after each decision
- ✅ Retention policy enforced (30-day detailed + monthly rollups) (Q1)
- ✅ Export functionality produces readable JSON
- ✅ Records include sufficient metadata for debugging/cost analysis

---

## Validation Scenario 7: Multi-Session Quota Consistency

**Success Criteria**: Clarification Answer 3 (per-request quota checks)

### Prerequisites

- Multiple VS Code windows open with extension loaded
- Same VS Code workspace (share global configuration)

### Test Steps

```
# Window 1
Command Palette → "Claude Switcher: Show Quota Dashboard"
Note: Current subscription usage, e.g., "85%"

# Window 2
Command Palette → Run Claude Code request
Expected: Quota increments (Window 1 dashboard should see update if refreshed)

# Window 1
Refresh dashboard (reload webview)
Expected: Quota incremented by 1 request (both sessions track consistently)
```

### Expected Outcomes

- ✅ Per-request quota checking ensures multi-session visibility (Q3)
- ✅ No duplicate quota counting (same request not counted multiple times)
- ✅ Simultaneous sessions see consistent quota state

---

## Performance Validation

**Success Criteria**: SC-003 (routing adaptation <1s, quota check <200ms)

### Test Steps

```
# Measure routing decision latency (use browser dev tools or logging)
Command Palette → Run 10 requests back-to-back
Expected: Median latency < 200ms (quota checking)
            P95 latency < 500ms
```

```
# Measure quota exhaustion transition latency
Settings → Manually set subscription.currentUsage = 29 (for dailyLimit=30)
Command Palette → Run request (exhausts quota)
Expected: Routing transition completes within 1 second of limit exceeded
            Fallback to API credits proceeds without interruption
```

### Expected Outcomes

- ✅ Quota checking per request <200ms latency (SC-003)
- ✅ Routing adaptation (exhaustion → fallback) <1 second (SC-003)

---

## Cleanup

After validation:

```bash
# Uninstall extension (if needed)
code --uninstall-extension claude-switcher.vscode-claude-switcher

# Clear test data
rm -Rf ~/Library/Application\ Support/Code/User/globalStorage/claude-switcher.*
```

---

## Troubleshooting

| Issue | Symptom | Solution |
|-------|---------|----------|
| Extension not loading | Commands not found in Command Palette | Check `npm run compile` succeeded; reload VS Code (`Cmd+Shift+P` → "Developer: Reload Window") |
| Harvey unreachable | Status bar always shows Claude | Verify Harvey service running: `curl http://localhost:11434health` (adjust endpoint) |
| Quota not tracking | Status bar shows 0% usage | Check configuration: `subscription.plan` and `dailyLimit` set correctly; reset quota command worked manually |
| API fallback failing | Requests fail with "No available sources" | Verify API key in SecretStorage (`secrets.get('claude.api-key')`) |
| Performance slow | Latency >200ms per request | Check logs for Harvey timeout; network calls to quota APIs delayed |
