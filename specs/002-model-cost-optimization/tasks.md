# Tasks: Model Cost Optimization

**Input**: Design documents from `/specs/002-model-cost-optimization/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Automated tests are REQUIRED per project Constitution (Principle IV). Test tasks are included for each user story.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Extension**: `src/`, `tests/` at repository root
- Paths below follow the existing single-project structure with new `quota/` and `routing/` subdirectories

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for new modules

- [X] T001 Create directory structure for quota and routing modules per plan.md: `src/core/quota/`, `src/core/routing/`, `tests/unit/core/quota/`, `tests/unit/core/routing/`, `tests/integration/core/routing/`

- [X] T002 Create base TypeScript module files with proper exports: `src/core/quota/quota-cache.ts`, `src/core/quota/quota-tracker.ts`, `src/core/quota/quota-provider.ts`, `src/core/routing/routing-engine.ts`, `src/core/routing/routing-config.ts`, `src/core/routing/routing-history.ts`, `src/core/routing/ollama-adapter.ts`

- [X] T003 Create GlobalStorage path helper in `src/core/routing/routing-history.ts` path constant for routing records directory: `context.globalStorageUri/routing-records/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 VS Code configuration schema extension for routing settings in `package.json` under `contributes.configuration` (see contracts/configuration.md for full schema)

- [X] T005 Implement configuration parsing and validation in `src/core/routing/routing-config.ts`: read RoutingConfiguration from vscode.workspace.getConfiguration('claudeSwitcher.routing'), validating dependency constraints (ollama in priority requires Harvey baseUrl), threshold order (fallback ≥ alert), and positive values for quota limits

- [X] T006 [P] Create quota cache data structure in `src/core/quota/quota-cache.ts`: SubscriptionQuotaState fields (plan, dailyLimit, rollingWindowDays, rollingWindowStart/End, currentUsage, remainingQuota, percentUsed, lastFetchTime, stale boolean) and APICreditsBalance fields (balance, lastFetchTime, stale, authenticated) with derived field calculations (remainingQuota = dailyLimit * rollingWindowDays - currentUsage, percentUsed = (currentUsage / (dailyLimit * rollingWindowDays)) * 100)

- [X] T007 [P] Create routing history file structure in `src/core/routing/routing-history.ts`: RoutingDecision interface (id: UUID, timestamp: ISO 8601, routedTo: enum subscription|api-credits|ollama, taskType: string, requestId?: string, quotaBefore/After: number, reason: string, performance?: object with latencyMs and circuitBreakerState), partitioned storage path `routing-records/daily/YYYY-MM-DD.json`, MonthlyRollup structure (month: YYYY-MM, totalRequests, usageBySource, usageByTaskType, totalLatencyMs, averageLatencyMs)

- [X] T008 Implement routing history file I/O operations in `src/core/routing/routing-history.ts`: methods writeDecision(Decision) to append to daily JSON file with array structure, readDecision(date) to load daily records, createMonthlyRollup(month) to aggregate 30-day records into summary, deleteDailyFiles(olderThanDays) for retention cleanup (per Q1: 30-day detailed + monthly rollups)

- [X] T009 Configure logger usage in `src/core/routing/` and `src/core/quota/` modules: import existing `src/utils/logger.ts`, log routing decisions at info/warn/error levels with JSON format (correlationId, taskId, routedTo, taskType, reason, latencyMs, timestamp)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configure Model Cost Preferences (Priority: P1) 🎯 MVP

**Goal**: Users can set model routing preferences in extension settings, validate configuration, and persist changes properly.

**Independent Test**: Open VS Code Settings at @ext:claude-switcher routing, modify priority array, save, reload extension, confirm configuration persists and is read correctly without errors.

### Tests for User Story 1

- [X] T010 [P] [US1] Unit test for configuration parsing in `tests/unit/core/routing/routing-config.test.ts`: validate valid config reads correctly, invalid config (ollama in priority but Harvey baseUrl empty) logs warning, threshold order validation (fallback < alert) logs warning, positive value checks for quota limits pass

- [X] T011 [P] [US1] Unit test for configuration persistence in `tests/unit/core/routing/routing-config.test.ts`: test configuration updates via vscode.workspace.updateConfiguration, verify value persists across session restart, test ConfigurationTarget.Global vs Workspace scoping

- [X] T012 [P] [US1] Integration test for configuration validation UI in `tests/integration/core/routing/routing-config-integration.test.ts`: open settings at routing section, modify field, save, verify error message shows for invalid config (empty Harvey baseUrl when ollama in priority)

### Implementation for User Story 1

- [X] T013 [P] [US1] Implement RoutingConfiguration interface and type constants in `src/core/routing/routing-config.ts`: ModelSource type enum ('subscription' | 'api-credits' | 'ollama'), TaskTypeMapping type Record<string, ModelSource | 'auto'>, Thresholds interface with subscriptionAlertPercent number and subscriptionFallbackPercent number, SubscriptionConfig interface with plan 'pro'|'max', dailyLimit number, rollingWindowDays number, and full RoutingConfiguration interface combining all these with required/optional flags

- [X] T014 [P] [US1] Implement configuration loader in `src/core/routing/routing-config.ts`: loadConfiguration() function calling vscode.workspace.getConfiguration('claudeSwitcher.routing'), returning Promise<RoutingConfiguration>, with defaults applied per contracts/configuration.md schema (priority ["subscription","api-credits","ollama"], autoFallback true, thresholds.subscriptionAlertPercent 80, thresholds.subscriptionFallbackPercent 100,.harvey.baseUrl "http://localhost:11434", subscription.plan "pro", subscription.dailyLimit 30, subscription.rollingWindowDays 7)

- [X] T015 [US1] Implement configuration validation in `src/core/routing/routing-config.ts`: validateConfiguration(config: RoutingConfiguration) function returning ValidationResult[valid: boolean, errors: string[]], checking ollama-in-priority requires non-empty Harvey baseUrl, subscriptionFallbackPercent >= subscriptionAlertPercent, plan is 'pro' or 'max', dailyLimit > 0, rollingWindowDays > 0; logging warnings via logger module for validation failures

- [X] T016 [US1] Implement configuration change listener in `src/core/vscode/extension.ts`: subscribe to vscode.workspace.onDidChangeConfiguration, filter event.affectsConfiguration('claudeSwitcher.routing'), reload RoutingConfiguration on change, re-validate configuration, log warnings if invalid

- [X] T017 [US1] Add task mappings configuration UI helper in `src/core/routing/routing-config.ts`: formatTaskMappings(mappings) function to serialize to JSON for settings display, parseTaskMappings(json) function with validation that values are valid ModelSource or 'auto'

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently (users can configure routing preferences)

---

## Phase 4: User Story 2 - Monitor Usage and Track Limits (Priority: P2)

**Goal**: Users can see current subscription quota usage and API credit balance in status bar and dashboard, with notifications approaching limits.

**Independent Test**: Configure subscription plan and limits (e.g., Pro plan, 30 daily messages), run multiple Code requests, observe status bar percentage increments, open dashboard via command, see usage statistics displayed, verify notification appears at alert threshold.

### Tests for User Story 2

- [X] T018 [P] [US2] Unit test for quota cache state transitions in `tests/unit/core/quota/quota-cache.test.ts`: test initialize() sets rolling window start to today and currentUsage to 0, test incrementUsage() updates currentUsage and recalculates remainingQuota, test isExhausted() returns true when currentUsage >= dailyLimit * rollingWindowDays, test refresh() resets stale flag and lastFetchTime

- [X] T019 [P] [US2] Unit test for APICreditsBalance in `tests/unit/core/quota/quota-provider.test.ts`: test initialize() reads API key from SecretStorage, sets authenticated flag, fetches initial balance via quotaProvider; test decrementBalance() reduces balance; test isExhausted() returns true when balance <= 0

- [ ] T020 [P] [US2] Integration test for status bar updates in `tests/integration/core/quota/quota-statusbar-integration.test.ts`: create status bar widget, update quota percentage, verify text format "🎯 Sub: 85% | API: ∞ | 🦙 Ollama", verify tooltip shows current quota state, verify badge color changes (green → yellow → red at exhaustion)

- [ ] T021 [P] [US2] Integration test for quota dashboard webview in `tests/integration/core/quota/quota-dashboard-integration.test.ts`: open dashboard, verify webview shows subscription plan details (Pro/Max), rolling window dates, current usage and progress bar, API credit balance if authenticated, routing statistics for current session

### Implementation for User Story 2

- [X] T022 [P] [US2] Implement quota tracker logic (user-manual tracking per research) in `src/core/quota/quota-tracker.ts`: initialize(plan: 'pro'|'max', dailyLimit: number, rollingWindowDays: number) function to setup SubscriptionQuotaState with rolling window start today, rollingWindowEnd today + N days; incrementUsage() function to increment currentUsage, recalculate remainingQuota and percentUsed; isExhausted() function returning true when remainingQuota <= 0; resetUsage() function to set currentUsage = 0 and recalculate derived fields

- [X] T023 [P] [US2] Implement quota provider stub (no official subscription API) in `src/core/quota/quota-provider.ts`: fetchSubscriptionUsage() returns currentUsage from quota-tracker (user-manual per research), fetchAPIBalance() returns balance from SecretStorage key; these are stubs for future official API integration

- [X] T024 [P] [US2] Implement APICreditsBalance manager in `src/core/quota/quota-cache.ts`: initialize() reads SecretStorage 'claude.api-key', sets authenticated true if exists, calls quotaProvider.fetchAPIBalance(); decrementBalance(tokens: number) reduces balance; refreshBalance() updates balance from provider; isExhausted() returns balance <= 0

- [X] T025 [US2] Implement status bar widget in `src/vscode/views/quota-status-bar.ts`: createStatusBarItem() returns vscode.StatusBarItem with ID 'claudeSwitcher.routing.statusBarItem', initial text "🎯 Sub: 0% | API: ∞ | 🦙 Ollama", command 'claudeSwitcher.routing.showQuota', tooltip "Model Cost Optimization: Click for details"; updateStatus(quota: QuotaSnapshot) function updates text based on quota state (normal/warning/exhaustion), colorizes badge, sets tooltip with current quota details; show() and hide() functions

- [X] T026 [US2] Implement quota dashboard webview in `src/vscode/views/quota-dashboard.ts`: createDashboard() creates vscode.WebviewPanel with title "Claude Switcher: Quota Dashboard", renders HTML template with sections: subscription plan and rolling window (Pro/Max, daily limit, rolling window dates), current usage progress bar (percentUsed calc), API credit balance (if authenticated), routing statistics (requests by source, by taskType), recent routing decisions list (last 10 from routing-history); updateDashboard() refreshes data and re-renders HTML; showDashboard() command handler calling createDashboard()

- [X] T027 [US2] Implement notification for alert threshold in `src/vscode/extension.ts`: monitor percentUsage after each incrementVia routing-engine, if percentUsed >= config.thresholds.subscriptionAlertPercent and not already alerted, show vscode.InformationMessage "Subscription quota at {percent}% used. Approaching limit. Consider reducing usage or enabling auto-fallback to Ollama", set alerted flag to avoid duplicate notifications

**Checkpoint**: At this point, User Story 2 should be fully functional (status bar shows quota, dashboard displays detailed usage)

---

## Phase 5: User Story 3 - Automatic Failover to API Credits (Priority: P2)

**Goal**: When subscription exhausted, system automatically routes to API credits, shows notification, and maintains 95% uptime during transition.

**Independent Test**: Configure subscription quota near exhaustion (e.g., 29/30 used), trigger request causing exhaustion, observe fallback notification, verify request completes via API credits, verify status bar shows "❌ Sub: 100% → API", repeat 5 requests to verify 95% uptime and <1s transition latency.

### Tests for User Story 3

- [X] T028 [P] [US3] Unit test for routing engine subscription-exhaustion logic in `tests/unit/core/routing/routing-engine.test.ts`: mock subscriptionQuotaState.remainingQuota = 0, apiCreditsBalance.balance = 1000, call route(request), expect决策 returns API credits source with reason "Priority fallback: api-credits", expect isAvailable('subscription') returns false, expect isAvailable('api-credits') returns true

- [X] T029 [P] [US3] Unit test for routing engine performance constraint (<200ms quota check) in `tests/unit/core/routing/routing-engine.test.ts`: mock 1000 consecutive route() calls, measure median latency, verify median < 200ms, verify P95 < 500ms

- [X] T030 [P] [US3] Integration test for quota exhaustion transition in `tests/integration/core/routing/routing-transition-integration.test.ts`: setup subscription quota 29/30, apiCredit balance 5000, make request triggering exhaustion, verify routing decision within 1s of limit exceeded, verify notification "Routing change: subscription exhausted → API credits" shows once, verify next 4 requests all succeed via API credits (95% uptime)

- [X] T031 [P] [US3] Regression test for rolling window reset in `tests/integration/core/routing/routing-reset-integration.test.ts`: exhaust subscription (30/30), wait for rolling window advancement (simulate time), verify QuotaTracker detects new window, resets currentUsage to 0, routing resumes to subscription, status bar updates accordingly

### Implementation for User Story 3

- [X] T032 [P] [US3] Implement routing engine interface in `src/core/routing/routing-engine.ts`: IRoutingEngine interface with methods route(request: RoutingRequest): Promise<RoutingDecision>, isAvailable(source: ModelSource): Promise<boolean>, getQuotaState(): QuotaSnapshot, refreshQuota(): Promise<void>, resetHistory(): void; re-export types RoutingRequest, RoutingDecision, ModelSource, QuotaSnapshot

- [X] T032 [P] [US3] Implement routing algorithm (pure logic, no vscode imports) in `src/core/routing/routing-engine.ts`: route(request) method implementing per contracts/routing-engine-interface.md algorithm: (1) check taskMappings config for explicit route, (2) if mapping is 'auto' or not found, call Harvey for recommendation (skip for US3, US4), (3) fallback to priority array [subscription, api-credits, ollama], (4) for each source check isAvailable(source), (5) return first available source with reason "Priority fallback: {source}", (6) if none available throw RoutingError('NO_AVAILABLE_SOURCES', 'No available model sources: subscription exhausted, API credits exhausted, Ollama unavailable')

- [X] T033 [P] [US3] Implement isAvailable quota checks in `src/core/routing/routing-engine.ts`: isAvailable('subscription') checks QuotaState.subscription.remainingQuota > 0; isAvailable('api-credits') checks QuotaState.apiCreditsBalance.balance > 0 and authenticated === true; isAvailable('ollama') checks Harvey reachable (placeholder for US4)

- [X] T034 [US3] Implement quota state integration in routing engine constructor: accept routingConfig: RoutingConfiguration, quotaCache: QuotaCache, initialize QuotaTracker from config.subscription fields, initialize APICreditsBalance, set up QuotaCache subscriptionWithout

- [ ] T035 [US3] Implement routing record writing in route() method: after routing decision, call routingHistory.writeDecision(decision) to persist to GlobalStorage, increment quotaSource (subscription or API credits) in QuotaCache if applicable

- [X] T036 [US3] Implement subscription reset detection in `src/core/quota/quota-tracker.ts`: checkRollingWindowReset() function comparing current date to rollingWindowEnd, if date > rollingWindowEnd, reset rollingWindowStart to today, rollingWindowEnd to today + rollingWindowDays, set currentUsage = 0; call this on extension startup and before each route() decision

- [X] T037 [US3] Implement transition notification in `src/core/vscode/extension.ts`: subscribe to routing decisions, detect source change from 'subscription' to 'api-credits', show vscode.InformationMessage "Routing change: subscription exhausted → API credits" once per transition, log warning with logger

- [X] T038 [US3] Implement performance monitoring for <200ms constraint in route() method: start timer at method entry, stop timer after isAvailable checks complete, record latency in RoutingDecision.performance.quotaCheckLatencyMs, log warning if latency >= 200ms

**Checkpoint**: At this point, User Story 3 should be fully functional (automatic API credits fallback with 95% uptime)

---

## Phase 6: User Story 4 - Use Local Ollama (Priority: P3)

**Goal**: System routes suitable tasks to local Ollama via Harvey service, auto-fallsback to Ollama when Claude budgets exhausted, handles Harvey unavailability gracefully.

**Independent Test**: Configure taskMappings { "code-review": "ollama" }, run code-review request, verify status bar shows "🦙 Ollama", verify Harvey called and logs success, stop Harvey service, repeat request, verify graceful fallback to Claude with notification, restart Harvey, run configuration validation command, verify connection recovers, کمی exhausted both subscription and API credits, run any request, verify auto-fallback to Ollama triggers (per Q2 answer).

### Tests for User Story 4

- [ ] T039 [P] [US4] Unit test for Harvey HTTP client in `tests/unit/core/routing/ollama-adapter.test.ts`: mock fetch() returning Harvey recommendation {routedTo: 'ollama', model: 'llama3.2', confidence: 0.9}, verify getRecommendation(taskType) returns parsed response; test connection refused → throw RoutingError('HARVEY_UNREACHABLE'); test timeout >200ms → throw RoutingError

- [ ] T040 [P] [US4] Unit test for circuit breaker pattern in `tests/unit/core/routing/ollama-adapter.test.ts`: test 5 consecutive failures open circuit breaker, test 60s cooldown transitions to HALF-OPEN, test successful response during HALF-OPEN closes circuit back to CLOSED; verify getCircuitBreakerState() returns correct state

- [ ] T041 [P] [US4] Unit test for auto-fallback to Ollama (both Claude exhausted) in `tests/unit/core/routing/routing-engine.test.ts`: set routingConfig.autoFallback = true, mock subscriptionQuotaState.remainingQuota = 0, apiCreditsBalance.balance = 0, call route(request), expect决策 returns 'ollama' with reason "自动备份到本地 Ollama (Claude budgets exhausted)", expect Harvey called to check availability

- [ ] T042 [P] [US4] Integration test for Harvey connectivity validation in `tests/integration/core/routing/harvey-connection-integration.test.ts`: run 'claudeSwitcher.routing.validateHarvey' command, Harvey running → webview shows success "Harvey service reachable and responding" with mock response; Harvey stopped → webview shows error "Cannot connect to Harvey: Connection refused (ECONNREFUSED), start Harvey with 'harvey serve --port 11434'"

- [ ] T043 [P] [US4] End-to-end integration test for Ollama routing in `tests/integration/core/routing/ollama-e2e-integration.test.ts`: configure routing.priority = ["ollama", "subscription"], taskMappings = {"code-review": "ollama"}, Harvey running, run code-review request, verify status bar "🦙 Ollama", verify routing-historic record shows routedTo: "ollama", verify no subscription/API credits consumed

### Implementation for User Story 4

- [ ] T044 [P] [US4] Implement Harvey HTTP client (ollama-adapter) in `src/core/routing/ollama-adapter.ts`: getRecommendation(taskType: string) function using Node.js fetch(), POST to config.harvey.baseUrl + '/route' (discover endpoint during implementation), request body {taskType, metadata: {contextLength, features: ['language-detection']}}, response parsing extracting routedTo, model, confidence; handle errors: connection refused (ECONNREFUSED), timeout (>200ms), 4xx/5xx responses, throw RoutingError('HARVEY_UNREACHABLE', error message)

- [ ] T045 [P] [US4] Implement circuit breaker in `src/core/routing/ollama-adapter.ts`: CircuitBreaker class with state 'closed'|'open'|'half-open', failureCount, lastFailureTime, cooldownMs = 60000; recordSuccess() resets failureCount and sets state 'closed'; recordFailure() increments failureCount, if failureCount >= 5 set state 'open' and lastFailureTime = now; getState() returns current circuit breaker state; tryCircuitBreaker() checks if state 'open' and now - lastFailureTime < cooldownMs throws error, else returns true allowing request; QuotaState.shouldAttemptHarvey() checks circuitBreaker.getState()

- [ ] T046 [P] [US4] Implement Harvey availability check in isAvailable('ollama') in `src/core/routing/routing-engine.ts`: return QuotaState.ollama.harveyReachable true AND QuotaState.ollama.circuitBreakerState !== 'open'; QuotaState tracks Harvey health from ollama-adapter responses (set harveyReachable = true on success, false on failure; circuitBreakerState from circuitBreaker.getState())

- [ ] T047 [US4] Implement Harvey recommendation call in route() algorithm: if taskMappings[taskType] is 'auto' or not found and 'ollama' in priority and shouldAttemptHarvey() true, call OllamaAdapter.getRecommendation(taskType) with 200ms timeout, if result.routedTo is 'ollama' OR 'ollama' in priority and result is null, decide route, log recommendation {model, confidence}, set RoutingDecision.harveyRecommendation = {model, confidence}

- [ ] T048 [US4] Implement auto-fallback rule in route() algorithm (per Q2 answer): after priority array iteration, if config.autoFallback true and all sources exhausted (subscriptionQuotaState.remainingQuota <= 0 AND apiCreditsBalance.balance <= 0) AND ollama available, route to Ollama with reason "自动备份到本地 Ollama (Claude budgets exhausted)", set QuotaState.ollama.autoFallbackTriggered = true

- [ ] T049 [US4] Implement Harvey connectivity validation command in `src/vscode/commands/routing-commands.ts`: create command 'claudeSwitcher.routing.validateHarvey', try fetch config.harvey.baseUrl + '/health' (or test route endpoint), if success show vscode.InformationMessage "Harvey service reachable and responding at {baseUrl}", on error show vscode.InformationMessage "Cannot connect to Harvey: {error}. Troubleshooting: 1. Verify Harvey running: 'harvey serve --port 11434' 2. Check baseUrl in settings 3. Check firewall rules"

- [ ] T050 [US4] Integrate Ollama routing into QuotaState in `src/core/quota/quota-cache.ts`: add ollama field {available: boolean, harveyReachable: boolean, circuitBreakerState: 'closed'|'open'|'half-open'}; update from routing-engine and ollama-adapter; expose in getQuotaSnapshot()

**Checkpoint**: At this point, User Story 4 should be fully functional (Ollama routing with Harvey integration + auto-fallback when Claude exhausted)

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T051 [P] Implement export history command in `src/vscode/commands/routing-commands.ts`: create command 'claudeSwitcher.routing.exportHistory', prompt user for save location via vscode.window.showSaveDialog with default filename 'routing-history-export.json', call routing-history.readDecision() to load all daily records (30 days), merge into single JSON array with all RoutingDecision objects, write to selected file path using Node.js fs.writeFileSync, show success message "Exported {count} routing records to {path}"

- [ ] T052 [P] Implement manual quota reset command in `src/vscode/commands/routing-commands.ts`: create command 'claudeSwitcher.routing.resetQuota', prompt user for confirmation vscode.window.showWarningMessage("Reset subscription quota to 0? This will restart your rolling window.", "Reset", "Cancel"), if user clicks "Reset", call QuotaTracker.resetUsage(), reset rollingWindowStart to today, log routing decision documenting manual reset, show success message "Quota tracking reset to 0, rolling window restarted"

- [ ] T053 [P] Implement configure routing shortcut command in `src/vscode/commands/routing-commands.ts`: create command 'claudeSwitcher.routing.configure', call vscode.openSettings('@ext:claude-switcher claudeSwitcher.routing'), settings open filtered to routing configuration

- [ ] T054 [P] Add click handler for status bar widget to open dashboard in `src/vscode/views/quota-status-bar.ts`: status bar item command 'claudeSwitcher.routing.showQuota' already set in T025, verify clicking opens dashboard webview

- [ ] T055 [P] Integrate all routing commands into package.json contributes.commands in `package.json`: add commands from contracts/commands.md (showQuota, resetQuota, configure, validateHarvey, exportHistory), ensure all commands registered with proper titles and categories

- [ ] T056 Implement routing history background cleanup task in `src/core/routing/routing-history.ts`: create cleanupOldRecords() function called on extension startup, reads daily files older than 30 days using fs.readdirSync() and fs.statSync(), calculates age, deletes files >30 days old with fs.unlinkSync(), calls createMonthlyRollup() before deletion for each month being cleaned

- [ ] T057 [P] Add logging improvements for cost analysis in `src/core/routing/routing-history.ts`: writeDecision() logs JSON with additional fields for cost tracking: {correlationId, taskId, routedTo, taskType, reason, quotaBefore, quotaAfter, estimatedCost: number (if API credits)}

- [ ] T058 Performance validation: run quickstart.md validation_scenario_7, measure median latency <200ms, P95 <500ms, verify routing adaptation <1s for quota exhaustion transition, benchmark with 1000 route() calls, record results, log warnings if thresholds not met

- [ ] T059 Cross-story integration test in `tests/integration/core/routing/full-workflow-integration.test.ts`: setup all user stories components (configuration, quota tracking, routing engine, Harvey), run complete workflow: configure routing, exhaust subscription, auto-fallback to API credits, exhaust API credits, auto-fallback to Ollama, verify each transition, verify all routing decisions written to history, verify status bar updates throughout

- [ ] T060 Documentation updates: README.md add section "Model Cost Optimization" with description, configuration examples, commands reference, troubleshooting for Harvey connectivity, update package.json description to mention routing feature

- [ ] T061 Code cleanup and refactoring: extract magic numbers to constants (30ms, 200ms latency, 1s transition, 5 failure threshold, 60s cooldown), add type exports to index barrel files if needed, ensure all new modules export correct types

- [ ] T062 Security hardening: verify no secrets (API keys) in logs (Principle III), redact API key from error messages, validate Harvey baseUrl prevents SSRF (block non-local IPs, allow only localhost/127.0.0.1 by default), add user-configurable allow-list for Harvey hosts

- [ ] T063 Run quickstart.md validation for all 7 scenarios: reproduce each validation scenario in quickstart.md using manual testing or automated scripts, document any issues found, fix failing scenarios, ensure all success criteria met

- [ ] T064 Final constitution compliance review: rerun constitution check from plan.md Phase 1, verify all principles and gates still passing, especially Principle IV (tests included), Principle V (no new runtime dependencies, Harvey is external), Principle III (secrets only in SecretStorage)

**Checkpoint**: All user stories and polish complete, feature ready for merge

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001-T003) - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed) or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 7)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (T004-T009) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational - Depends on US1 T004 (configuration schema shared), but independently testable (Status bar and dashboard can exist without routing decisions)
- **User Story 3 (P3)**: Can start after Foundational AND US2 (QuotaTracker from US2 T022, APICreditsBalance from US2 T024) - Requires quota tracking infrastructure
- **User Story 4 (P4)**: Can start after Foundational AND US3 (RoutingEngine from US3 T032) - Requires routing engine to call Harvey

### Within Each User Story

- Tests MUST follow Principle IV: Prefer test-first but ensure tests pass before merge
- Configuration parsing/logic before UI components
- Models/services before endpoints/commands
- Core implementation before integration

### Parallel Opportunities

- All Setup tasks marked [P] (T002) can run in parallel
- All Foundational tasks marked [P] (T006, T007) can run in parallel (within Phase 2)
- Once Foundational phase completes, user stories can start: US1 only needs T004, US2 needs T004+T006+T007, US3 needs T004+T006+T007+T022+T024, US4 needs T004+T006+T007+T032+T044+T045 → **US1 and US2 can start in parallel after Foundational**; US3 waits for US2; US4 waits for US3

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for configuration parsing in tests/unit/core/routing/routing-config.test.ts"
Task: "Unit test for configuration persistence in tests/unit/core/routing/routing-config.test.ts"
Task: "Integration test for configuration validation UI in tests/integration/core/routing/routing-config-integration.test.ts"

# Launch all routing config model interfaces together:
Task: "Implement RoutingConfiguration interface and type constants in src/core/routing/routing-config.ts"
Task: "Implement configuration loader in src/core/routing/routing-config.ts"

# Contrast: T015 (validation) MUST wait for T014 (loader) pass dependencies, so not parallel with T014
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T009) - **CRITICAL BLOCKER**
3. Complete Phase 3: User Story 1 (T010-T017)
4. **STOP and VALIDATE**: Run validation_scenario_1 from quickstart.md, test configuration independently
5. Users can configure routing preferences - usable increment

### Incremental Delivery (Recommended for this feature)

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (**P1**) → Test independently → Deploy/Demo (MVP config!)
3. Add User Story 2 (**P2**) → Test independently → Deploy/Demo (Quota visibility!)
4. Add User Story 3 (**P2**) → Test independently → Deploy/Demo (Automatic failover!)
5. Add User Story 4 (**P3**) → Test independently → Deploy/Demo (Ollama integration!)
6. Complete Phase 7: Polish (T051-T064)
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T009)
2. Once Foundational is done:
   - Developer A: User Story 1 (T010-T017) - Configuration
   - Developer B: User Story 2 (T018-T027) - Quota tracking/status bar - depends on T004 from A
3. Once US1 and US2 complete:
   - Developer A: User Story 3 (T028-T038) - API credits fallback - depends on US2
   - Developer B: Continue US2 or start Polish tasks
4. Once US3 complete:
   - Developer A: User Story 4 (T039-T050) - Ollama/Harvey - depends on US3
   - Developer B: Polish tasks T051-T064
5. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability (US1-US4)
- Each user story should be independently completable and testable
- Tests follow Principle IV: Unit tests for pure logic, Integration tests for VS Code behavior
- Quota tracking is user-manual per research (no official subscription API)
- Harvey runs as external HTTP service per clarification
- Performance constraints: <200ms quota checking, <1s routing adaptation (SC-003)
- Retention: 30-day detailed records + monthly rollups (Q1)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

---

**Total Tasks**: 64 (excluding placeholders)

**Task Count by Story**:
- Setup (Phase 1): 3 tasks
- Foundational (Phase 2): 6 tasks
- User Story 1 (P1, Configuration): 8 tasks
- User Story 2 (P2, Monitor Usage): 10 tasks
- User Story 3 (P2, API Fallback): 11 tasks
- User Story 4 (P3, Ollama): 12 tasks
- Polish (Phase 7): 14 tasks

**Ready for Implementation**: `/speckit-implement` ✅
