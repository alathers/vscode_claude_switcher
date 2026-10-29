# Implementation Plan: Model Cost Optimization

**Branch**: `002-model-cost-optimization` | **Date**: 2026-10-28 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-model-cost-optimization/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Add cost-optimized model routing to the VS Code extension that:
1. Prioritizes Claude.ai subscription usage (Pro/Max) before consuming API credits
2. Monitors subscription quota and displays usage to users
3. Automatically fails over to API credits when subscription limits are reached
4. Integrates with local Ollama via Harvey HTTP service for suitable tasks
5. Uses hybrid routing: user-configured task type mappings plus automatic detection
6. Retains routing decision records for 30 days with monthly rollups
7. Checks quota on every request (<200ms latency target) to support multiple sessions

Technical approach: Build a quota tracking service, routing engine, and configuration layer within the existing extension architecture, integrating with Harvey router as an external HTTP dependency.

## Technical Context

**Language/Version**: TypeScript 5.x with Node.js 20+

**Primary Dependencies**:
- VS Code Extension API (`@types/vscode`) - extension host integration
- Node.js built-ins (`fetch`, `https`) - HTTP requests for Harvey and quota tracking
- Existing extension modules (no new runtime dependencies added)

**Storage**:
- VS Code Configuration: Routing preferences, threshold settings
- VS Code SecretStorage: API keys (API credits) - following Principle III
- File-based (data state): Routing decision records with 30-day retention + monthly rollups
- In-memory cache: Current quota state to minimize API calls

**Testing**:
- Unit tests: Jest (existing) for quota tracking, routing logic, configuration parsing
- Integration tests: VS Code extension host (existing) for end-to-end routing scenarios
- Contract tests: Mock Harvey HTTP service responses, mock quota API responses

**Target Platform**: VS Code extensions (cross-platform: macOS primary, Windows/Linux supported per existing codebase)

**Project Type**: Desktop extension (VS Code)

**Performance Goals**:
- Quota checking latency: <200ms per request (SC-003 clarifies 1-second total routing adaptation)
- Configuration UI load time: <2 seconds (SC-001)
- Routing transition uptime: 95% during quota exhaustion (SC-002)

**Constraints**:
- Must use stable VS Code APIs (Principle I)
- Must store secrets in SecretStorage only (Principle III)
- Must work in multiple simultaneous Claude sessions (clarified: per-request quota checks)
- Minimal runtime dependencies (Principle V)
- Harvey router runs as separate local HTTP service (external dependency)

**Scale/Scope**:
- Single user's development session per VS Code instance
- Support multiple simultaneous Claude Code sessions
- Routing records: 30 days detailed + monthly rollups (manageable local storage)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-Phase 0 Result**: ✅ ALL GATES PASS (see detailed check below)

**Post-Phase 0 Re-check**: ✅ NO NEW VIOLATIONS (research findings aligned with constitution)

Research findings confirmed:
- User-manual quota tracking via Configuration API ✅ (Principle I)
- Harvey HTTP integration using built-in `fetch` ✅ (Principle V)
- GlobalStorage for routing records (official VS Code API) ✅ (Principle I)
- No new runtime dependencies ✅ (Principle V)
- No telemetry added ✅ (Principle III)

Proceed to Phase 1 design.

**Post-Phase 1 Re-check**: ✅ NO NEW VIOLATIONS (design artifacts aligned with constitution)

Phase 1 artifacts reviewed:
- [`data-model.md`](data-model.md): Uses VS Code Configuration API, GlobalStorage, SecretStorage ✅ (Principle I, III)
- [`contracts/configuration.md`](contracts/configuration.md): Settings schema uses official VS Code contributes.configuration ✅
- [`contracts/commands.md`](contracts/commands.md): All commands registered in package.json, discoverable ✅ (Principle I)
- [`contracts/routing-engine-interface.md`](contracts/routing-engine-interface.md): Interface separates VS Code integration from pure logic ✅ (Principle IV)

Design confirmed constitution-compliant. Proceed to Phase 2 (`/speckit-tasks`).

### I. Native VS Code Integration

| Requirement | Status | Notes |
|------------|--------|-------|
| Use only stable, public APIs | ✅ PASS | Will use VS Code Configuration, SecretStorage, and command APIs |
| Features reachable through contribution points | ✅ PASS | Will register commands in `package.json` and status bar item |
| Settings via `workspace.getConfiguration` | ✅ PASS | Routing preferences in user settings |
| External adapter for file formats | ✅ PASS | Harvey HTTP integration via dedicated module |

### II. Safe, Reversible Switching

| Requirement | Status | Notes |
|------------|--------|-------|
| Atomic switch operations | ✅ PASS | Config writes will be atomic (write-to-temp-then-rename) |
| Validate state before applying | ✅ PASS | Validate Harvey connectivity and Ollama config before routing |
| Recoverable previous state | ✅ PASS | Configuration backup/restore capability |
| Never delete user config without confirmation | ✅ PASS | User must explicitly reset/delete preferences |
| Active selection always visible | ✅ PASS | Status bar item shows current routing (subscription/API/Ollama) |

### III. Secrets & Privacy

| Requirement | Status | Notes |
|------------|--------|-------|
| Secrets in SecretStorage only | ✅ PASS | API credits key stored in SecretStorage |
| No secrets in logs/error messages | ✅ PASS | Redact API keys and sensitive quota data |
| No telemetry unless specified | ✅ PASS | No telemetry added by this feature |
| Honor `vscode.env.isTelemetryEnabled` | ✅ PASS | N/A for this feature |

### IV. Tested Behavior

| Requirement | Status | Notes |
|------------|--------|-------|
| Automated tests for acceptance scenarios | ✅ PASS | Unit tests for quota/routing logic, integration tests for VS Code behavior |
| Pure logic separated from extension host | ✅ PASS | Quota tracking and routing logic in non-vscode-importing modules |
| Extension host behavior covered | ✅ PASS | Integration tests for command registration and config updates |
| Bug fixes include regression tests | ✅ PASS | Will add regression tests if bugs found during implementation |

### V. Lightweight & Simple

| Requirement | Status | Notes |
|------------|--------|-------|
| Specific activation events | ✅ PASS | Will use command-specific activation events; `*` avoided |
| Minimal runtime dependencies | ✅ PASS | No new npm dependencies; Harvey is external HTTP service |
| YAGNI: meet current needs | ✅ PASS | No speculative features beyond specified routing requirements |

### Technical Constraints

| Requirement | Status | Notes |
|------------|--------|-------|
| TypeScript strict mode | ✅ PASS | Existing project uses strict mode |
| Minimum VS Code 1.90.0 | ✅ PASS | Compatible with existing extension requirement |
| Platform-agnostic paths | ✅ PASS | Use `path`, `os.homedir()`, `vscode.Uri` |
| VSIX packaging | ✅ PASS | Test packing and .vscodeignore during implementation |
| Semantic versioning | ✅ PASS | Follow versioning in package.json and CHANGELOG.md |

### Development Workflow & Quality Gates

| Requirement | Status | Notes |
|------------|--------|-------|
| Spec Kit flow: specify → clarify → plan → tasks → implement | ✅ PASS | Following documented flow |
| Constitution check before/after design | ✅ PASS | This check; will re-check after Phase 1 |
| Type check zero errors | ✅ PASS | Will run `tsc --noEmit` before merge |
| Linting zero errors | ✅ PASS | Will run linter before merge |
| All tests pass | ✅ PASS | Will run unit and integration tests before merge |
| VSIX builds successfully | ✅ PASS | Will build VSIX before merge |
| Migration handling for settings changes | ✅ PASS | No breaking changes to settings format in this feature |

**Result**: ✅ **ALL GATES PASS** - No violations detected. No complexity tracking needed for constitution deviations.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
```text
src/
├── vscode/
│   ├── configuration/
│   │   ├── file-manager.ts
│   │   ├── secret-storage.ts
│   │   └── workspace-scoped.ts
│   ├── extension.ts (main entry)
│   └── views/
│       └── [new] quota-status-bar.ts  # Status bar widget for routing info
│
├── core/
│   ├── quota/                    # NEW: Quota tracking and management
│   │   ├── quota-tracker.ts      # Subscription/API credits usage tracking
│   │   ├── quota-cache.ts        # In-memory cache for quota data
│   │   └── quota-provider.ts     # Interface for different quota data sources
│   │
│   ├── routing/                  # NEW: Model routing engine
│   │   ├── routing-engine.ts     # Core routing decision logic (pure logic)
│   │   ├── routing-config.ts     # Configuration parsing and validation
│   │   ├── routing-history.ts    # Record storage (30-day retention)
│   │   └── ollama-adapter.ts     # Harvey router HTTP client
│   │
│   ├── adapters/
│   │   ├── native-claude.ts (existing)
│   │   ├── ollama.ts (existing)
│   │   └── ...
│   │
│   └── ... (existing modules: handoff, state, audit, validation, policy)
│
└── utils/
    ├── logger.ts (existing)
    ├── retry.ts (existing)
    └── ...

tests/
├── integration/
│   └── core/
│       └── routing/
│           └── routing-end-to-end.test.ts  # NEW: Integration tests
│
└── unit/
    └── core/
        ├── quota/                     # NEW: Quota tracking unit tests
        │   ├── quota-tracker.test.ts
        │   ├── quota-cache.test.ts
        │   └── quota-provider.test.ts
        │
        └── routing/                   # NEW: Routing engine unit tests
            ├── routing-engine.test.ts
            ├── routing-config.test.ts
            ├── routing-history.test.ts
            └── ollama-adapter.test.ts
```

**Structure Decision**: Single project structure following existing extension layout. New modules added to `src/core/quota/` and `src/core/routing/` directories, with corresponding test coverage in `tests/`. This follows the existing pattern (state, handoff, audit, validation, policy) and keeps routing/quota logic independent of VS Code APIs for unit testability (Principle IV).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No constitution violations detected. Complexity tracking not required.*
