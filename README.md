# Claude Switcher - Model Profile Orchestrator

A VS Code extension for managing and switching between AI coding-agent model profiles during development sessions, with intelligent cost optimization routing across multiple model sources.

## Features

### Model Cost Optimization ⭐

The Model Cost Optimization feature automatically routes your requests to the most cost-effective model source based on your configuration and quota state:

- **Subscription-first routing**: Uses your paid Claude.ai subscription (Pro/Max) first by default — no marginal cost
- **API credits fallback**: Automatically switches to prepaid API credits when subscription limits are reached
- **Local Ollama integration**: Fails over to local models via Harvey router when both Claude budgets are exhausted
- **Task-based routing**: Configure specific task types to prefer particular model sources
- **Smart quota tracking**: Tracks subscription usage on a rolling window and API credit balance
- **Harvey router integration**: Connects to local Harvey HTTP service for intelligent routing recommendations

This helps maximize your subscription value by exhausting it before drawing down prepaid credits, and provides a local fallback option when cloud budgets are exhausted.

## Configuration

Enable and configure Model Cost Optimization in VS Code Settings:

1. Open Settings (`Cmd+,` on macOS, `Ctrl+,` on Windows/Linux)
2. Search for "@ext:claude-switcher routing"
3. Configure the following options:

### Routing Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeSwitcher.routing.priority` | Ordered list of model sources (first non-exhausted is used) | `["subscription", "api-credits", "ollama"]` |
| `claudeSwitcher.routing.autoFallback` | Auto-fallback to local Ollama when both Claude budgets exhausted | `true` |
| `claudeSwitcher.routing.taskMappings` | Map task types to specific model sources or 'auto' | `{}` |
| `claudeSwitcher.routing.harvey.baseUrl` | Base URL for Harvey router HTTP service | `http://localhost:11434` |

### Subscription Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeSwitcher.routing.subscription.plan` | Your Claude.ai plan type | `"pro"` |
| `claudeSwitcher.routing.subscription.dailyLimit` | Daily message limit (5 messages per priority window for Pro) | `30` |
| `claudeSwitcher.routing.subscription.rollingWindowDays` | Rolling window duration | `7` |

*Note: For accurate quota tracking, verify current limits periodically at https://support.claude.com*

### Thresholds Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `claudeSwitcher.routing.thresholds.subscriptionAlertPercent` | Notify when quota usage reaches this percentage | `80` |
| `claudeSwitcher.routing.thresholds.subscriptionFallbackPercent` | Switch to API credits at this percentage | `100` |

## Configuration Examples

### Example 1: Basic subscription-first routing

```json
{
  "claudeSwitcher.routing.priority": ["subscription", "api-credits", "ollama"],
  "claudeSwitcher.routing.autoFallback": true,
  "claudeSwitcher.routing.subscription.plan": "pro",
  "claudeSwitcher.routing.subscription.dailyLimit": 30,
  "claudeSwitcher.routing.subscription.rollingWindowDays": 7
}
```

**Behavior**: Routes all requests to subscription first, API credits when subscription exhausted, then Ollama if both budgets are exhausted.

### Example 2: Code review to local Ollama

```json
{
  "claudeSwitcher.routing.priority": ["subscription", "api-credits", "ollama"],
  "claudeSwitcher.routing.autoFallback": true,
  "claudeSwitcher.routing.taskMappings": {
    "code-review": "ollama",
    "test-generation": "ollama",
    "complex-analysis": "subscription"
  }
}
```

**Behavior**: Code reviews and test generation go directly to local Ollama, complex analysis uses subscription, other tasks follow priority array.

### Example 3: Ollama-first for development

```json
{
  "claudeSwitcher.routing.priority": ["ollama", "subscription", "api-credits"],
  "claudeSwitcher.routing.autoFallback": true,
  "claudeSwitcher.routing.harvey.baseUrl": "http://localhost:11434"
}
```

**Behavior**: Routes to Ollama first (requires Harvey running), falls back to subscription, then API credits.

## Commands

The following commands are available from the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows/Linux):

### Claude Switcher Routing

| Command | Description |
|---------|-------------|
| `Claude Switcher: Export Routing History` | Export all routing decisions for the last 30 days to a JSON file |
| `Claude Switcher: Reset Subscription Quota` | Manually reset subscription quota tracking to 0 (restarts rolling window) |
| `Claude Switcher: Configure Routing Preferences` | Open extension settings at routing configuration |
| `Claude Switcher: Show Quota Dashboard` | Display current quota state and routing statistics (coming soon) |
| `Claude Switcher: Validate Harvey Connectivity` | Test connection to local Harvey router service |

## Troubleshooting

### Harvey Router Connection Issues

**Symptom**: "Cannot connect to Harvey" error or Ollama routing always fails

**Possible causes and solutions**:

1. **Harvey not running**
   - Start Harvey service: `harvey serve --port 11434`
   - Verify with: `validateHarvey` command

2. **Incorrect baseUrl**
   - Check setting: `claudeSwitcher.routing.harvey.baseUrl`
   - Default: `http://localhost:11434`
   - Do not use external URLs (security hardening prevents non-localhost connections)

3. **Port conflicts**
   - Check if port 11434 is in use: `lsof -i :11434` (macOS/Linux)
   - Change Harvey port or update baseUrl setting if needed

4. **Firewall blocking**
   - Ensure firewall allows connections to localhost:11434
   - Check local network settings for any blocking rules

### Quota Tracking Issues

**Symptom**: Quota percentages don't match actual usage

**Solutions**:

1. Verify subscription plan limits are current at https://support.claude.com
2. Update `dailyLimit` and `rollingWindowDays` settings if plan changed
3. Manually reset quota with `resetSubscriptionQuota` command to restart tracking
4. Check that rolling window dates are correct for your timezone

### Status Bar Not Showing

**Symptom**: Model source status not visible in status bar

**Solution**:
- Status bar updates are coming in a future release
- Currently check quota via the `showQuota` command (coming soon) or routing history export

## Architecture

The Model Cost Optimization feature consists of several core modules:

- **Routing Engine** (`src/core/routing/routing-engine.ts`) - Makes routing decisions based on quota state, configuration, and Harvey recommendations
- **Quota Cache** (`src/core/quota/quota-cache.ts`) - Tracks subscription and API credit quota state
- **Routing History** (`src/core/routing/routing-history.ts`) - Persists routing decisions to GlobalStorage with 30-day retention
- **Ollama Adapter** (`src/core/routing/ollama-adapter.ts`) - Manages communication with Harvey router with circuit breaker pattern
- **Routing Config** (`src/core/routing/routing-config.ts`) - Handles configuration loading and validation

## Contributing

This project is under active development. Model Cost Optimization is a major feature currently being implemented.

## License

MIT
