# Implementation Plan: VS Code Model Profile Orchestrator

**Branch**: `001-vscode-plugin-generator` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-vscode-plugin-generator/spec.md`

## Summary

Build a VS Code extension that enables developers to select, switch between, and coordinate multiple AI coding-agent model profiles during open VS Code sessions. The extension manages profiles for local, private-network, and cloud model providers through a native-first experience using the official Claude Code panel. Privacy boundaries are enforced through configurable policies that distinguish model-provider traffic from supporting network operations. Profile selection and switching work without restarting VS Code, with air-gapped support for local models. Per-user observability shows concurrent activity without cross-user visibility. All secrets are managed through VS Code SecretStorage, profile templates are repository-committed non-secret configurations, and handoff between profiles supports full transcript, reviewed summary, or no-context transfer with user control.

## Technical Context

**Language/Version**: TypeScript 5.5+ with strict compiler mode enabled (constitution requirement)

**Primary Dependencies**:
- VS Code Extension API (stable, public APIs only)
- VS Code SecretStorage for credential management
- Node.js built-in modules (path, os, crypto, events, stream) for core functionality
- Minimized runtime dependencies; each new dependency requires justification

**Storage**:
- VS Code SecretStorage: API keys, local-server secrets, credential references
- Workspace files (JSON/YAML):
  - User profiles: `~/.claude-claude-switcher/profiles/` (local, non-secret)
  - Repository templates: `.claude-switcher/templates/` (committed, non-secret)
  - Workspace policy: `.claude-switcher/policy.yaml` (workspace-scoped)
  - Handoff metadata: `~/.claude-claude-switcher/handoffs/` (local, configurable retention)
  - Audit metadata: `~/.claude-claude-switcher/audit.log` (local, no prohibited content)

**Testing**:
- Unit tests: Vitest for pure logic modules (adaptation checks, policy engine, parsing, state machine)
- Integration tests: VS Code Test Runner for extension host behavior (commands, configuration updates, status bar state)
- Regression tests: Required for all bug fixes

**Target Platform**: macOS and Linux (FR-080); platform-agnostic paths using `path`, `os.homedir()`, `vscode.Uri`

**Project Type**: VS Code extension with native Claude Code panel integration, CLI fallback, optional webview

**Performance Goals** (from spec SC-001 to SC-012):
- Profile selection and activation: < 10 seconds
- Profile switching with handoff: < 5 seconds (summary and no-context modes)
- Default profile validation: < 3 seconds, no billable API calls
- Conflict warning display: < 2 seconds after detection
- VS Code startup overhead increase: < 100 milliseconds
- 100% success rate for profile switching without VS Code restart

**Constraints**:
- < 100ms additional VS Code startup time (non-negotiable per constitution)
- Strict mode must block 100% of unauthorized cloud requests before data transmission
- Offline capability for local models and cached validation results
- Air-gapped environment support (no cloud dependencies for core functionality)
- Profile limits and concurrent session limits configurable per workspace
- Activation events only on workspace presence and command invocation, never `*`
- Minimal runtime dependencies; preferred approach uses Node.js and VS Code built-ins
- Test coverage mandatory for all features, with pure logic modules tested without extension host

**Scale/Scope**:
- Small trusted team distribution (local VSIX, not public marketplace in v1)
- Configurable limits per workspace: maximum profiles, concurrent sessions, handoff metadata size
- Per-user observability only (no cross-user visibility of profile usage or activity)
- Repository templates shared through Git, secrets handled locally per developer

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Native VS Code Integration

**Requirement**: Use only stable, public VS Code extension APIs. All user-facing features reachable through declared contribution points.

**Planned Approach**:
- Use @types/vscode for typed API access; target VS Code version calibrated to minimum widely-distributed stable release
- Register all commands through package.json `contributes.commands`
- Expose profile selector through command palette, status bar, and optionally a view container
- All settings through `vscode.workspace.getConfiguration` respecting user/workspace scope
- Isolate external file formats (.claude-switcher YAML, Claude config) in dedicated adapter modules

✅ **COMPLIANT**: Architecture uses stable public API pattern; adapter modules contain external format isolation

### II. Safe, Reversible Switching

**Requirement**: Switch operations must be atomic, validated before application, recoverable, non-destructive, with visible active state.

**Planned Approach**:
- Profile activation uses write-to-temp-then-rename for configuration file mutations
- Validate target state (configuration parsing, secret reference existence, endpoint reachability check) before applying
- Maintain previous state backup in `~/.claude-claude-switcher/backups/` for recovery
- Never delete or overwrite user-authored configuration without explicit user confirmation
- Display currently active profile in status bar at all times when extension is active

✅ **COMPLIANT**: Atomic file operations, validation-first approach, backup recovery mechanism, status bar visibility

### III. Secrets & Privacy

**Requirement**: Credentials stored only via SecretStorage; never logs/secrets in output/notifications; no telemetry/network unless required; honor `telemetryEnabled`.

**Planned Approach**:
- All API keys, local-server secrets go through `vscode.ExtensionContext.secrets`
- Secret references only in workspace/user configuration; values never in logs, error messages, or notifications
- Log redaction: secrets replaced with hash identifiers or `[REDACTED]`
- No telemetry collection; any future telemetry requires `vscode.env.isTelemetryEnabled` check and documentation
- Network requests only for explicit features: model provider requests, validation endpoints, health checks
- All network usage documented in README with opt-out options

✅ **COMPLIANT**: SecretStorage for all secrets, redaction mechanism, no telemetry by default, documented network usage

### IV. Tested Behavior

**Requirement**: Every feature ships with automated tests; pure logic in modules without vscode; integration tests for host behavior; regression tests for bug fixes.

**Planned Approach**:
- Vitest for unit tests covering: adapter conformance checks, policy engine, parsing/validation, state machine logic
- Modules without `import vscode` include fast unit tests; use strict TypeScript separation
- Integration tests using `vscode-extension-tester` or VS Code Test Runner for: command registration, configuration updates, status bar state, profile selection UI
- Every bug fix must include regression test that fails without the fix
- Documentation encourages test-first workflow but gate is existence/passing tests

✅ **COMPLIANT**: Dual test strategy enforced through architecture (pure logic modules + integration tests), regression test requirement

### V. Lightweight & Simple

**Requirement**: Use specific activation events (never `*`); minimize runtime dependencies; features for current needs only (YAGNI).

**Planned Approach**:
- Activation events: `onCommand`, `workspaceContains:.claude-switcher/**`, `onView` if views added (no `*`, no `onStartupFinished`)
- Core runtime dependencies: VS Code API (bundled), Node.js built-ins, minimal utility libraries
- Each additional dependency requires justification in plan document before implementation
- No speculative configuration knobs or abstraction layers without use case from spec
- Feature scope limited to spec-defined requirements only

✅ **COMPLIANT**: Specific activation events, minimal dependencies, YAGNI principle enforced, no unknown abstractions

### Technical Constraints

**Requirement**: TypeScript strict mode; minimum engines.vscode; platform-agnostic paths; VSIX packaging; semantic versioning; CHANGELOG.

**Planned Approach**:
- TypeScript strict mode enabled in tsconfig.json; `any` types require inline comment justification
- Declare minimum VS Code version in package.json `engines.vscode`; use only APIs at that version
- Use `path`, `os.homedir()`, `vscode.Uri` for all paths; no hard-coded separators or home paths
- Package with `@vscode/vsce`, exclude tests and development files via `.vscodeignore`
- Follow semantic versioning for package.json `version`; user-visible changes in CHANGELOG.md
- Marketplace Gate inactive: public release postponed until distribution decision (local VSIX vs. Marketplace)

✅ **COMPLIANT**: All technical constraints addressed; documentation commits to platform-agnostic path handling

**Overall Constitution Check**: ✅ **PASS** - All principles and constraints satisfied. No violations. No Justification Required <br/>[spec.md](./spec.md)

### Phase 1: Data Model, Contracts & Quickstart (< 100k tokens)

**Data Model** → `data-model.md` (~10k tokens)<br/>
- Extract entities: Profile, ProfileTemplate, WorkspacePolicy, CredentialReference, Session, Handoff, ActivityLedger, PrivacyClassification
- Define fields, types, validation rules, relationships from FR-001 to FR-083
- State transitions: profile activation, handoff flows, session lifecycle, policy changes

**Contracts** → `contracts/` (~15k tokens)<br/>
- `/contracts/profile-schema.md` - Profile/Template/Policy YAML schema (Zod or JSON Schema)<br/>
- `/contracts/api-commands.md` - VS Code command interface (schema + responses)<br/>
- `/contracts/ui-contracts.md` - Profile selector, handoff dialog, activity ledger contract<br/>
- `/contracts/adapter-interface.md` - Provider adapter abstract interface with capability declarations

**Quickstart** → `quickstart.md` (~5k tokens)<br/>
- Define validation scenarios for profile selection, switching with handoff, privacy policy enforcement, concurrent agents
- Document prerequisites: Claude Code CLI, local SSH config for tunnel profiles, additional setup for adapters
- Setup commands for profile templates, workspace policy, test profiles
- Test/run commands and expected outcomes (no implementation code or full test suites)

### Phase 1.5: Re-check Constitution

After data model and contracts are designed, re-evaluate Constitution Check sections to ensure design choices remain compliant. If new violations appear, add to Complexity Tracking or revise design.

---

## Project Structure

### Documentation (this feature)

```text
specs/001-vscode-plugin-generator/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── profile-schema.md
│   ├── api-commands.md
│   ├── ui-contracts.md
│   └── adapter-interface.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── state/
│   │   ├── profile-registry.ts       # Pure logic: profile loading, merging defaults, validation
│   │   ├── state-machine.ts          # Pure logic: activation, handoff state machine
│   │   └── activity-tracker.ts       # Pure logic: concurrent session tracking, conflict detection
│   ├── policy/
│   │   ├── policy-engine.ts          # Pure logic: privacy mode, request classification, routing decisions
│   │   ├── policy-parser.ts          # Pure logic: workspace policy YAML parsing, validation
│   │   └── guard-distributor.ts      # Pure logic: approval flow, timeout, multi-approver tracking
│   ├── adapters/
│   │   ├── contract.ts               # Adapter interface with capability declarations
│   │   ├── native-claude.ts          # Adapter: Claude Code CLI + config manipulation
│   │   ├── anthropic-compatible.ts   # Adapter: Anthropic-compatible HTTP API
│   │   ├── openai-compatible.ts     # Adapter: OpenAI-compatible HTTP API
│   │   ├── ollama.ts                 # Adapter: Ollama HTTP API
│   │   └── generic-command.ts        # Adapter: Shell command with sanitized environment
│   ├── validation/
│   │   ├── profile-validator.ts       # Pure logic: schema + policy + secret + endpoint validation
│   │   ├── capability-checker.ts      # Pure logic: adapter capability validation vs. adapter declarations
│   │   └ ├── secret-resolution.ts    # Pure logic: secret reference validation in SecretStorage
│   ├── handoff/
│   │   ├── summarizer.ts             # Pure logic: local summarizer, deterministic outline fallback
│   │   ├── transcript-oracle.ts      # Pure logic: transcript retrieval via adapters
│   │   └── handoff-serializer.ts     # Pure logic: handoff packet creation, metadata tracking
│   └── audit/
│       ├── audit-writer.ts           # Pure logic: audit log writing without prohibited content
│       └── redaction-engine.ts       # Pure logic: secret/intern content redaction

├── vscode/
│   ├── extension.ts                  # Extension activation/deactivation, command registration
│   ├── configuration/
│   │   ├── workspace-scoped.ts       # VS Code API: workspace configuration read/write
│   │   ├── secret-storage.ts         # VS Code API: SecretStorage wrapper (isolated from core)
│   │   └── file-manager.ts          # VS Code API: file I/O adapter (isolated from core)
│   ├── ui/
│   │   ├── profiles/
│   │   │   ├── profile-selector.ts   # Profile selection UI (command palette, status bar)
│   │   │   └── profile-editor.ts     # Profile creation/editing UI
│   │   ├── handoff/
│   │   │   ├── handoff-dialog.ts     # Handoff mode selection: full/summary/none + configuration
│   │   │   └── summary-editor.ts    # Review and customize summary before handoff
│   │   ├── privacy/
│   │   │   └── policy-editor.ts      # Workspace policy editor privacy modes, concurrency rules
│   │   └── activity/
│   │       ├── ledger-view.ts        # Activity ledger view: profiles, states, conflicts
│   │       └── conflict-warning.ts  # Conflict notification UI (before mutation)
│   ├── commands/
│   │   ├── profile-commands.ts       # Profile-related commands (select, create, edit, validate)
│   │   ├── handoff-commands.ts       # Handoff commands (switch, full/summary/none options)
│   │   ├── policy-commands.ts         # Policy commands (set mode, approve/deny, configure guards)
│   │   └── validation-commands.ts     # Validation commands (profile validate, diagnostics)
│   └── integration/
│       ├── claude-code-proxy.ts      # Claude Code CLI integration proxy (isolated adapter, no VS Code API leakage)
│       └── status-bar.ts             # Status bar: current profile, integration mode, warnings

├── utils/
│   ├── path-normalizer.ts            # Platform-agnostic path handling (path, os.homedir, vscode.Uri)
│   ├── logger.ts                     # Core logger with redaction support (no VS Code API)
│   ├── crypto-utils.ts               # Hash, redaction helpers (secrets)
│   └── retry.ts                      # Retry logic for endpoint checks (non-VS Code)

tests/
├── unit/
│   ├── core/
│   │   ├── state/
│   │   │   ├── profile-registry.test.ts
│   │   │   ├── state-machine.test.ts
│   │   │   └── activity-tracker.test.ts
│   │   ├── policy/
│   │   │   ├── policy-engine.test.ts
│   │   │   ├── policy-parser.test.ts
│   │   │   └── guard-distributor.test.ts
│   │   ├── adapters/
│   │   │   ├── contract.test.ts
│   │   │   └── (adapter mock tests)
│   │   ├── validation/
│   │   │   ├── profile-validator.test.ts
│   │   │   ├── capability-checker.test.ts
│   │   │   └── secret-resolution.test.ts
│   │   ├── handoff/
│   │   │   ├── summarizer.test.ts
│   │   │   ├── transcript-oracle.test.ts
│   │   │   └── handoff-serializer.test.ts
│   │   └── audit/
│   │       ├── audit-writer.test.ts
│   │       └── redaction-engine.test.ts
│   └── utils/
│       ├── path-normalizer.test.ts
│       ├── logger.test.ts
│       └── crypto-utils.test.ts
├── integration/
│   ├── vscode/
│   │   ├── extension.test.ts         # Extension activation tests
│   │   ├── configuration.test.ts    # Configuration read/write tests
│   │   └── secret-storage.test.ts    # SecretStorage isolation tests
│   ├── ui/
│   │   ├── profile-selector.test.ts  # Profile selection UI tests
│   │   ├── handoff-dialog.test.ts    # Handoff dialog tests
│   │   └── activity-ledger.test.ts   # Activity ledger visibility tests
│   └── integration/
│       ├── claude-code-proxy.test.ts # Claude Code CLI integration tests
│       └── end-to-end.test.ts        # End-to-end user journey tests

package.json
tsconfig.json
.eslintrc.js
jest.config.js                  # For unit tests (Vitest)
.vscodeignore                   # Exclude tests, development files from VSIX
README.md
CHANGELOG.md
```

**Structure Decision**: The chosen structure isolates pure logic modules (no VS Code API imports) in `src/core/` for fast unit testing, while `src/vscode/` contains all VS Code API interactions. Adapters in `src/core/adapters/` define integration contracts without direct VS Code coupling. Dependencies are minimized: only VS Code API (bundled) and Node.js built-ins. Testing follows the constitution requirement: pure logic modules have unit tests (`tests/unit/`), VS Code integration tests (`tests/integration/vscode/`) cover command registration, configuration, and status bar. Runtime dependencies are justified: each additional library beyond Node.js built-ins would require plan documentation. This structure supports lightweight activation (`onCommand`, `workspaceContains:.claude-switcher/**`) and avoids `*` or `onStartupFinished`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | Constitution passed with no violations | N/A |
