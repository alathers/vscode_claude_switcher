# Command Contract

**Feature**: Model Cost Optimization
**Contract Type**: VS Code Extension Commands
**Date**: 2026-10-28

## Overview

This contract defines the commands exposed by the Model Cost Optimization feature. All commands are registered in `package.json` under `contributes.commands` and must be discoverable via the Command Palette (Principle I).

## Command Schema

### `claudeSwitcher.routing.showQuota`

**Description**: Display current subscription usage, API credit balance, and routing statistics in a VS Code webview panel.

**Parameters**: None

**Behavior**:
- Opens a webview panel displaying quota dashboard
- Shows:
  - Subscription plan details and rolling window
  - Current usage / remaining quota with progress bar
  - API credit balance (if authenticated)
  - Routing statistics for current session (requests by source, by task type)
  - Recent routing decisions list (last 10)

**Accessibility**: Command Palette (Cmd/Ctrl+Shift+P) → "Claude Switcher: Show Quota Dashboard"

---

### `claudeSwitcher.routing.resetQuota`

**Description**: Manually reset subscription quota tracking (e.g., after Claude Code session adjustment or rolling window restart).

**Parameters**: None

**Behavior**:
- Prompts user for confirmation: "Reset subscription quota to 0? This will restart your rolling window."
- If confirmed, resets `currentUsage` to 0 and recalculates `remainingQuota`
- Updates `rollingWindowStart` to today
- Records routing decision documenting manual reset

**Accessibility**: Command Palette → "Claude Switcher: Reset Quota Tracking"

---

### `claudeSwitcher.routing.configure`

**Description**: Open VS Code settings UI at the routing configuration section for quick editing.

**Parameters**: None

**Behavior**:
- Opens `vscode.openSettings` with filter `@ext:claude-switcher claudeSwitcher.routing`
- Focuses configuration editor for routing preferences

**Accessibility**: Command Palette → "Claude Switcher: Configure Routing"

---

### `claudeSwitcher.routing.validateHarvey`

**Description**: Test connectivity to Harvey router service and validate configuration.

**Parameters**: None

**Behavior**:
- Attempts to connect to `harvey.baseUrl` from configuration
- Sends test routing request (e.g., dummy "code-review" task)
- Displays result:
  - Success: "Harvey service reachable and responding" with response details
  - Failure: "Cannot connect to Harvey: [error reason]" with troubleshooting tips

**Accessibility**: Command Palette → "Claude Switcher: Validate Harvey Connection"

---

### `claudeSwitcher.routing.exportHistory`

**Description**: Export routing decision history (last 30 days) to JSON file for offline analysis.

**Parameters**: None

**Behavior**:
- Prompts user for file save location via `vscode.window.showSaveDialog`
- Exports all daily routing record files (30-day window) as a single JSON array
- File contains: all routing records with full metadata

**Accessibility**: Command Palette → "Claude Switcher: Export Routing History"

---

### `claudeSwitcher.routing.toggleOllama` (Optional, if budget permits)

**Description**: Quick toggle to enable/disable Ollama routing for current session (without editing full configuration).

**Parameters**: None

**Behavior**:
- If `"ollama"` is currently in priority list: removes it temporarily for this session
- If `"ollama"` is not in priority list: adds it temporarily for this session
- Shows notification: "Ollama routing [enabled/disabled] for this session"
- Does not persist to global settings (session-scoped override)

**Accessibility**: Command Palette → "Claude Switcher: Toggle Local Ollama"

---

## Status Bar Widget

### `claudeSwitcher.routing.statusBarItem`

**Description**: Status bar item showing current routing source and quota percentage.

**Text Format**:
- Normal: "🎯 Sub: 85% | API: ∞ | 🦙 Ollama" (percentage represents subscription usage)
- Warning (approaching limit): "⚠️ Sub: 95% | API: ∞"
- Error (exhausted): "❌ Sub: 100% → API"
- Ollama active: "🦙 Ollama"

**Behavior**:
- Always visible while extension is active (Principle II: active selection visible)
- Clicking status bar item opens quota dashboard (`claudeSwitcher.routing.showQuota`)
- Updates in real-time as requests are routed

**Tooltip**:
```
Model Cost Optimization
Subscription: Pro plan, 85% used (7-day rolling window)
API Credits: 12,345 tokens remaining
Ollama: Harvey service reachable
Last routed: 2m ago (ollama for code-review)
```

---

## Error Handling

All commands must:
1. Provide user-friendly error messages (no stack traces in notifications)
2. Log detailed errors to `logger` module for debugging
3. Gracefully degrade if underlying services (Harvey, quota APIs) are unavailable
4. Use `this.errorBoundary` pattern for command handlers if available

## Testing Contract

All commands must have integration tests that:
1. Register command via `vscode.commands.registerCommand`
2. Simulate user invocation
3. Verify UI behavior (webview opens, notification shown, settings opened)
4. Mock external dependencies (Harvey, quota APIs)
