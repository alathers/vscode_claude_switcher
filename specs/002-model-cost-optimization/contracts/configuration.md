# Configuration Contract

**Feature**: Model Cost Optimization
**Contract Type**: VS Code Extension Settings Schema
**Date**: 2026-10-28

## Overview

This contract defines the VS Code configuration schema exposed by the Model Cost Optimization feature. Configuration is stored in `package.json` under `contributes.configuration` and accessed via `vscode.workspace.getConfiguration('claudeSwitcher.routing')`.

## Configuration Schema

```jsonc
{
  "claudeSwitcher.routing.priority": {
    "type": "array",
    "items": {
      "type": "string",
      "enum": ["subscription", "api-credits", "ollama"]
    },
    "default": ["subscription", "api-credits", "ollama"],
    "description": "Ordered list of model sources to route requests. First non-exhausted source is used."
  },

  "claudeSwitcher.routing.taskMappings": {
    "type": "object",
    "additionalProperties": {
      "type": "string",
      "enum": ["subscription", "api-credits", "ollama", "auto"]
    },
    "default": {},
    "description": "Map task types to specific model sources. Use 'auto' to let Harvey router decide automatically. Example: {\"code-review\": \"ollama\", \"test-generation\": \"ollama\", \"complex-analysis\": \"subscription\"}"
  },

  "claudeSwitcher.routing.autoFallback": {
    "type": "boolean",
    "default": true,
    "description": "If true, automatically fallback to local Ollama when both subscription and API credits are exhausted."
  },

  "claudeSwitcher.routing.thresholds.subscriptionAlertPercent": {
    "type": "number",
    "minimum": 0,
    "maximum": 100,
    "default": 80,
    "description": "Notification threshold: notify when subscription quota usage reaches this percentage (0-100)."
  },

  "claudeSwitcher.routing.thresholds.subscriptionFallbackPercent": {
    "type": "number",
    "minimum": 0,
    "maximum": 100,
    "default": 100,
    "description": "Automatic fallback threshold: switch to API credits when subscription quota usage reaches this percentage (0-100)."
  },

  "claudeSwitcher.routing.harvey.baseUrl": {
    "type": "string",
    "format": "uri",
    "default": "http://localhost:11434",
    "description": "Base URL for Harvey router HTTP service. Required when 'ollama' is in priority list."
  },

  "claudeSwitcher.routing.subscription.plan": {
    "type": "string",
    "enum": ["pro", "max"],
    "default": "pro",
    "description": "Your Claude.ai subscription plan type (Pro or Max). Determines rolling window limits from https://support.claude.com."
  },

  "claudeSwitcher.routing.subscription.dailyLimit": {
    "type": "number",
    "minimum": 1,
    "default": 30,
    "description": "Daily message limit for your plan (from https://support.claude.com). Verify current limits periodically."
  },

  "claudeSwitcher.routing.subscription.rollingWindowDays": {
    "type": "number",
    "minimum": 1,
    "default": 7,
    "description": "Rolling window duration in days (Pro=7 days, Max=14 days per Claude documentation)."
  }
}
```

## Usage Patterns

### Reading Configuration

```typescript
const config = vscode.workspace.getConfiguration('claudeSwitcher.routing');

const priority = config.get<string[]>('priority', ['subscription', 'api-credits', 'ollama']);
const taskMappings = config.get<Record<string, string>>('taskMappings', {});
const autoFallback = config.get<boolean>('autoFallback', true);
const thresholds = {
  subscriptionAlertPercent: config.get<number>('thresholds.subscriptionAlertPercent', 80),
  subscriptionFallbackPercent: config.get<number>('thresholds.subscriptionFallbackPercent', 100)
};
const harveyBaseUrl = config.get<string>('harvey.baseUrl', 'http://localhost:11434');
const subscription = {
  plan: config.get<'pro' | 'max'>('subscription.plan', 'pro'),
  dailyLimit: config.get<number>('subscription.dailyLimit', 30),
  rollingWindowDays: config.get<number>('subscription.rollingWindowDays', 7)
};
```

### Writing Configuration

```typescript
const config = vscode.workspace.getConfiguration('claudeSwitcher.routing');

await config.update('priority', ['subscription', 'ollama', 'api-credits'], vscode.ConfigurationTarget.Global);
await config.update('taskMappings', { 'code-review': 'ollama' }, vscode.ConfigurationTarget.Global);
await config.update('subscription.dailyLimit', 30, vscode.ConfigurationTarget.Global);
```

### Listening for Configuration Changes

```typescript
const configListener = vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('claudeSwitcher.routing')) {
    // Reload configuration, reinitialize quota state, etc.
  }
});
```

## Validation Constraints

1. **Dependency Validation**: If `"ollama"` is in `priority` array, `harvey.baseUrl` must be non-empty and a valid URI.
2. **Threshold Order**: `thresholds.subscriptionFallbackPercent` must be ≥ `thresholds.subscriptionAlertPercent`.
3. **Plan Limits**: `subscription.dailyLimit` and `subscription.rollingWindowDays` must be positive.

Invalid configurations should be logged as warnings but not prevent extension startup (graceful degradation).
