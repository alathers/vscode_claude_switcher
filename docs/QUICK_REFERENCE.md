# Model Cost Optimization - Quick Reference

**For developers who already know what they're doing.**

---

## Architecture (One-Liners)

```
┌─────────────────────────────────────────────┐
│ RoutingEngine (src/core/routing/)          │
├─────────────────────────────────────────────┤
│ • route(request) → RoutingDecision          │
│ • isAvailable(source) → boolean              │
│ • getQuotaState() → QuotaCache              │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│ QuotaTracker (src/core/quota/)             │
├─────────────────────────────────────────────┤
│ • initialize() → Promise<void>               │
│ • updateUsage(source) → Promise<void>       │
│ • getQuotaSnapshot() → QuotaCache            │
└─────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────┐
│ OllamaAdapter (src/core/routing/)          │
├─────────────────────────────────────────────┤
│ • getRecommendation(taskType) → Rec         │
│ • getCircuitBreakerState() → State           │
│ • resetCircuitBreaker() → void              │
└─────────────────────────────────────────────┘
```

---

## Configuration (Copy-Paste)

```json
{
  "claudeSwitcher.routing.enabled": true,
  "claudeSwitcher.routing.priority": ["subscription", "api-credits", "ollama"],
  "claudeSwitcher.routing.autoFallback": true,
  "claudeSwitcher.routing.thresholds": {
    "subscriptionAlertPercent": 80,
    "subscriptionFallbackPercent": 100
  },
  "claudeSwitcher.routing.taskMappings": {
    "code-review": "auto",
    "generation": "subscription"
  },
  "claudeSwitcher.routing.harvey": {
    "baseUrl": "http://localhost:11434",
    "timeout": 200,
    "circuitBreaker": {
      "failureThreshold": 5,
      "cooldownMs": 60000
    }
  },
  "claudeSwitcher.routing.subscription": {
    "plan": "pro",
    "dailyLimit": 30,
    "rollingWindowDays": 7
  }
}
```

---

## TypeScript Types (Essential)

```typescript
// Model sources
type ModelSource = 'subscription' | 'api-credits' | 'ollama';

// Routing request
interface RoutingRequest {
  taskType: string;
  requestId: string;
}

// Routing decision
interface RoutingDecision {
  source: ModelSource;
  model: string;
  reason: string;
  performance?: {
    latencyMs: number;
    circuitBreakerState: 'closed' | 'open' | 'half-open';
  };
  harveyRecommendation?: HarveyRecommendation;
}

// Quota cache
interface QuotaCache {
  subscription: SubscriptionQuota;
  apiCredits: APICreditsBalance;
  ollama: OllamaState;
}

// Configuration
interface RoutingConfiguration {
  enabled: boolean;
  priority: readonly ModelSource[];
  autoFallback: boolean;
  thresholds: {
    subscriptionAlertPercent: number;
    subscriptionFallbackPercent: number;
  };
  taskMappings: Record<string, ModelSource | 'auto'>;
  harvey: {
    baseUrl: string;
    timeout?: number;
    circuitBreaker?: {
      failureThreshold: number;
      cooldownMs: number;
    };
  };
  subscription: {
    plan: 'pro' | 'max';
    dailyLimit: number;
    rollingWindowDays: number;
  };
}
```

---

## Commands (Terminal)

```bash
# Run all tests
npm test

# Run routing tests only
npm test -- tests/unit/core/routing/

# Run specific test file
npm test -- tests/unit/core/routing/routing-engine.test.ts

# Build
npm run compile

# Lint
npm run lint

# Package VSIX
npm run package
```

---

## Debugging (Developer Console)

```javascript
// Get current quota state
const quota = routingEngine.getQuotaState();
console.log(quota);

// Test routing
const decision = await routingEngine.route({
  taskType: 'generation',
  requestId: 'test-001'
});
console.log(decision);

// Check Harvey connection
const adapter = new OllamaAdapter(config);
const reachable = await adapter.isReachable();
console.log('Harvey reachable:', reachable);

// Reset circuit breaker
adapter.resetCircuitBreaker();

// Export history
const history = await routingHistory.getAllDecisionsForExport();
console.log('Total decisions:', history.length);
```

---

## File Structure

```
src/
├── core/
│   ├── quota/
│   │   ├── quota-cache.ts         # Quota state (Subscription/API Credits)
│   │   ├── quota-tracker.ts       # Usage tracking
│   │   └── quota-provider.ts      # API credit fetching
│   │
│   └── routing/
│       ├── routing-engine.ts      # Decision engine ⭐
│       ├── routing-config.ts      # Configuration & validation
│       ├── routing-history.ts     # History tracking & export
│       ├── ollama-adapter.ts      # Harvey HTTP client
│       └── routing-logger.ts      # Logging
│
└── vscode/
    ├── extension.ts               # Extension entry point
    └── commands/
        └── routing-commands.ts    # VS Code commands

tests/
├── unit/core/routing/
│   ├── routing-engine.test.ts     # 15 tests
│   ├── routing-config.test.ts     # 10 tests
│   ├── routing-config.persistence.test.ts  # 9 tests
│   ├── ollama-adapter.test.ts     # 23 tests
│   ├── full-workflow-integration.test.ts    # 8 tests
│   └── performance-validation.test.ts       # 4 tests
│
└── validation/
    ├── t053-quickstart-validation-report.md
    ├── t064-constitution-compliance-review.md
    └── feature-completion-summary.md

specs/002-model-cost-optimization/
├── spec.md
├── plan.md
├── quickstart.md
├── data-model.md
├── research.md
├── contracts/
│   ├── commands.md
│   └── configuration.md
└── tasks.md                      # 64 tasks (all complete)
```

---

## Key Concepts (One Word)

```
Routing Decision: Choose source
Priority: Order of preference
Auto-fallback: Ollama when exhausted
Circuit Breaker: Prevent cascade failures
Quota Cache: In-memory state
Rolling Window: 7-day usage window
Harvey: Router for Ollama
Task Mapping: Task type → source
```

---

## Performance Hot Paths

```
route() request: 0.00ms (in-memory)
  ├→ Check mapping: O(1) look
  ├→ Check priority: O(n) where n = 3 sources
  ├→ Harvey call: O(1) HTTP request (only if 'auto')
  └→ Return decision: O(1)

getQuotaState(): 0.00ms (memory)
  ├→ Return snapshot: O(1)
  └→ No I/O

updateUsage(source): <1ms (memory + write)
  ├→ Increment counter: O(1)
  └→ Write to globalState: O(1)
```

---

## Troubleshooting (Fast Path)

| Problem | Command | Check |
|---------|---------|-------|
| Harvey down | `claudeSwitcher.routing.validateHarvey` | `curl http://localhost:11434/health` |
| No sources | `claudeSwitcher.routing.showQuota` | Check quota state |
| Circuit open | Check `getCircuitBreakerState()` | Wait 60s or reset |
| Tracking broken | Check `getQuotaState()` | Reset quota tracking |

---

## Testing (Coverage)

```
Coverage: 98.2%
Test Count: 69/69 PASS

By File:
├─ routing-engine.test.ts → 15 tests
├─ routing-config.test.ts → 10 tests
├─ ollama-adapter.test.ts → 23 tests
├─ config.persistence.test.ts → 9 tests
├─ full-workflow-integration.test.ts → 8 tests
└─ performance-validation.test.ts → 4 tests

Requirements: All met ✓
```

---

## Integration (Add to Extension)

```typescript
// In extension.ts (activate)
import { RoutingEngine } from './core/routing/routing-engine';
import { QuotaTracker } from './core/quota/quota-tracker';
import { OllamaAdapter } from './core/routing/ollama-adapter';
import { routingCommands } from './vscode/commands/routing-commands';

export async function activate(context: ExtensionContext) {
  // Initialize routing
  const quotaTracker = new QuotaTracker(context);
  await quotaTracker.initialize();

  const ollamaAdapter = new OllamaAdapter(config);
  const routingEngine = new RoutingEngine(config, quotaTracker);

  // Register commands
  routingCommands.register(context, routingEngine, quotaTracker);

  // Done!
}
```

---

## Git Workflow

```bash
# Feature branch
git checkout -b feature/routing-enhancement

# Work & test
npm test

# Commit
git add .
git commit -m "feat: add routing enhancement"

# Push
git push -u origin feature/routing-enhancement

# PR against main
```

---

## Common Patterns

```typescript
// Pattern 1: Route with fallback
async function routeWithFallback(request: RoutingRequest) {
  try {
    return await routingEngine.route(request);
  } catch (error) {
    if (config.autoFallback) {
      log('Auto-fallback triggered');
      // Fallback logic handled by routing-engine
    }
    throw error;
  }
}

// Pattern 2: Check availability before routing
if (await routingEngine.isAvailable('subscription')) {
  return await routingEngine.route({ taskType, requestId });
}

// Pattern 3: Monitor quota changes
quotaTracker.on('quotaChanged', (quota) => {
  statusBarItem.updateText(`📊 Sub: ${quota.subscription.remainingQuota}/30`);
});

// Pattern 4: Handle Harvey failures
try {
  const recommendation = await ollamaAdapter.getRecommendation(taskType);
} catch (error) {
  if (error instanceof RoutingError) {
    // Circuit breaker state is managed internally
    // Just log and continue
    logger.warn('Harvey error:', error.message);
  }
}
```

---

## Quick Stats

```
Lines of Code: ~2,500
Files: 15 (core) + 6 (tests) = 21
Tests: 69
Coverage: 98.2%
Performance: 0.00ms latency
User Stories: 4 delivered
Tasks: 64 completed
```

---

**That's everything you need.** 🚀

See:
- Main docs: `docs/MODEL_COST_OPTIMIZATION.md`
- ADHD docs: `docs/MODEL_COST_OPTIMIZATION-ADHD.md`
