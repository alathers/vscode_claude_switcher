---

description: "Task list for feature implementation"
---

# Tasks: VS Code Claude Model Rotator

**Input**: Design documents from `/specs/001-vscode-plugin-generator/`

**Prerequisites**: spec.md (required for user stories), contracts/api-commands.md (required for API contracts)

**Tests**: Tests are MANDATORY per spec - this project uses dual testing strategy (Vitest for pure logic, VS Code integration tests for extension behavior)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source code**: `src/` (pure logic in `src/core/`, VS Code integration in `src/vscode/`)
- **Tests**: `tests/unit/` (Vitest), `tests/integration/` (VS Code Test Runner)

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project structure: src/core/(endpoints/, status/, routing/), src/vscode/(configuration/, ui/, commands/, integration/), src/utils/, tests/unit/, tests/integration/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Pure Logic Utilities (No VS Code API Dependencies)

- [X] T002 [P] Create url-validator.ts in src/utils/url-validator.ts - HTTP/HTTPS URL validation logic (no VS Code API imports)
- [X] T003 [P] Create logger.ts in src/utils/logger.ts - Core logger with redaction support, no VS Code API imports
- [X] T004 [P] Create crypto-utils.ts in src/utils/crypto-utils.ts - Hash and redaction helpers for secrets (no VS Code API imports)
- [X] T005 [P] Create retry.ts in src/utils/retry.ts - Retry logic for endpoint checks, no VS Code API imports

### Core State Management (Pure Logic)

- [X] T006 Create endpoint-registry.ts in src/core/endpoints/endpoint-registry.ts - Endpoint CRUD operations, model management, validation logic (no VS Code API imports)
- [X] T007 [P] Create status-tracker.ts in src/core/status/status-tracker.ts - Endpoint connectivity status tracking, latency monitoring (no VS Code API imports)
- [X] T008 [P] Create routing-engine.ts in src/core/routing/routing-engine.ts - Active endpoint selection and management (no VS Code API imports)

### VS Code Integration Layer (All VS Code API Access Isolated Here)

- [X] T009 Create workspace-config.ts in src/vscode/configuration/workspace-config.ts - VS Code workspace configuration persistence (isolates VS Code API access)
- [X] T010 [P] Create secret-storage.ts in src/vscode/configuration/secret-storage.ts - VS Code SecretStorage wrapper for auth tokens (isolates VS Code API access)
- [X] T011 [P] Create claude-code-integrator.ts in src/vscode/integration/claude-code-integrator.ts - Claude Code panel reload, configuration file manipulation, interface management (isolates VS Code API access)

### Extension Entry Point

- [X] T012 Create extension.ts in src/vscode/extension.ts - Extension activation/deactivation, command registration (all VS Code API access here)

### Unit Tests for Foundational Logic (Mandatory TDD - Write First, Ensure They Fail)

- [X] T013 [P] Test url-validator.ts in tests/unit/utils/url-validator.test.ts
- [X] T014 [P] Test logger.ts in tests/unit/utils/logger.test.ts
- [X] T015 [P] Test crypto-utils.ts in tests/unit/utils/crypto-utils.test.ts
- [X] T016 [P] Test retry.ts in tests/unit/utils/retry.test.ts
- [X] T017 [P] Test endpoint-registry.ts in tests/unit/core/endpoints/endpoint-registry.test.ts
- [X] T018 [P] Test status-tracker.ts in tests/unit/core/status/status-tracker.test.ts
- [X] T019 [P] Test routing-engine.ts in tests/unit/core/routing/routing-engine.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Configure model endpoints (Priority: P1) 🎯 MVP

**Goal**: Developers can configure one or more Claude API endpoints (URL, auth token, models with names and aliases), with connectivity status tracking and persistence across VS Code restarts.

**Independent Test**: A developer adds endpoints through command palette, provides URLs, optional auth tokens, and models with names and aliases. Endpoints are saved, persisted across VS Code restarts, and connectivity status is displayed (connected, untested, unreachable). SSH tunnel endpoints (localhost URLs) work without auth tokens.

### Unit Tests for User Story 1 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T020 [P] [US1] Endpoint CRUD operations (add, edit, remove) in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T021 [P] [US1] Model name and alias storage/validation in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T022 [P] [US1] Endpoint validation (URL format, models list) in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T023 [P] [US1] Unique endpoint ID generation in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T024 [P] [US1] Connectivity status tracking (connected/untested/unreachable) in tests/unit/core/status/status-tracker.test.ts
- [ ] T025 [P] [US1] Latency measurement and caching in tests/unit/core/status/status-tracker.test.ts
- [ ] T026 [P] [US1] Secret reference redaction in tests/unit/utils/crypto-utils.test.ts

### Integration Tests for User Story 1 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T027 [P] [US1] Add endpoint command registration in tests/integration/vscode/extension.test.ts
- [ ] T028 [P] [US1] Webview UI for endpoint creation in tests/integration/ui/endpoint-editor.test.ts
- [ ] T029 [P] [US1] Secret storage integration with VS Code SecretStorage in tests/integration/vscode/secret-storage.test.ts
- [ ] T030 [P] [US1] Endpoint configuration persistence in tests/integration/vscode/configuration.test.ts

### Implementation for User Story 1

- [ ] T031 [P] [US1] Implement URL validation in src/utils/url-validator.ts (Validate HTTP/HTTPS URLs, support localhost and SSH tunnel URLs, reject malformed URLs - FR-002)
- [ ] T032 [P] [US1] Implement endpoint registry in src/core/endpoints/endpoint-registry.ts (CRUD operations for endpoints with URL, auth token, label, models [name, alias], generate unique IDs, validate endpoint configuration - FR-001, FR-003, FR-004, FR-005)
- [ ] T033 [P] [US1] Implement model management in src/core/endpoints/endpoint-registry.ts (Add/edit/remove models, validate model names, support optional aliases, ensure models scoped to endpoints - FR-006, FR-007)
- [ ] T034 [P] [US1] Implement status tracker in src/core/status/status-tracker.ts (Track connectivity status: connected/untested/unreachable, measure latency, cache results, perform lightweight connectivity checks that don't consume API quota - FR-020, FR-021)
- [ ] T035 [P] [US1] Implement workspace config in src/vscode/configuration/workspace-config.ts (Persist endpoint configuration across VS Code restarts, load configuration on activation - FR-004)
- [ ] T036 [P] [US1] Implement secret storage in src/vscode/configuration/secret-storage.ts (Wrap vscode.ExtensionContext.secrets, getSecret/setSecret/deleteSecret methods, store auth tokens securely - FR-003, FR-044)
- [ ] T037 [US1] Implement endpoint editor webview UI in src/vscode/ui/endpoints/endpoint-editor.ts (Form with URL input, auth token input, models list with name/alias fields, add/edit/remove model buttons, validation feedback)
- [ ] T038 [US1] Implement endpoint-commands.ts in src/vscode/commands/endpoint-commands.ts (Commands: addEndpoint, editEndpoint, removeEndpoint, validate URL, manage models, handle secret storage)
- [ ] T039 [US1] Update extension.ts to register endpoint commands in src/vscode/extension.ts (Register claudeSwitcher.addEndpoint, claudeSwitcher.editEndpoint, claudeSwitcher.removeEndpoint)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Developers can configure endpoints, add models, and see connectivity status.

---

## Phase 4: User Story 2 - Select active model endpoint with reload (Priority: P1) 🎯 Critical Path

**Goal**: Developers can select which configured endpoint should receive Claude API calls, with automatic reload of the VS Code Claude Code panel to use the new endpoint. Handles the complex interface between plugin configuration and VS Code's Claude Code infrastructure.

**Independent Test**: A developer with multiple endpoints configured selects one as active. The plugin detects if Claude Code panel is active with an ongoing session, prompts user with options (continue with reload, keep unchanged, start new session), and reloads the panel to use the new endpoint. Subsequent Claude API calls route to the selected endpoint.

**Technical Challenge**: This is the most complex part of the implementation - requires interfacing with VS Code's Claude Code configuration files, managing panel reload timing, handling active sessions, and ensuring seamless transition.

### Unit Tests for User Story 2 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T040 [P] [US2] Active endpoint selection logic in tests/unit/core/routing/routing-engine.test.ts
- [ ] T041 [P] [US2] Session detection and state management in tests/unit/core/routing/routing-engine.test.ts
- [ ] T042 [P] [US2] Prompt scenario selection (continue/keep/new-session) in tests/unit/core/routing/routing-engine.test.ts
- [ ] T043 [P] [US2] Configuration file template generation in tests/unit/core/routing/routing-engine.test.ts
- [ ] T044 [P] [US2] Reload flow state machine (config update → panel reload → verification) in tests/unit/core/routing/routing-engine.test.ts

### Integration Tests for User Story 2 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T045 [P] [US2] Select active endpoint command in tests/integration/vscode/extension.test.ts
- [ ] T046 [P] [US2] Claude Code panel detection in tests/integration/vscode/claude-code.test.ts
- [ ] T047 [P] [US2] Panel reload flow in tests/integration/vscode/claude-code.test.ts
- [ ] T048 [P] [US2] Session prompt UI in tests/integration/ui/session-prompt.test.ts
- [ ] T049 [P] [US2] Configuration file manipulation in tests/integration/vscode/configuration.test.ts
- [ ] T050 [P] [US2] End-to-end endpoint switching with reload in tests/integration/end-to-end.test.ts

### Implementation for User Story 2

- [ ] T051 [P] [US2] Implement routing engine in src/core/routing/routing-engine.ts (Manage active endpoint selection, detect active Claude Code sessions, determine appropriate action: reload/keep/new-session, generate state machine for reload flow - FR-010, FR-015)
- [ ] T052 [P] [US2] Implement Claude Code integrator in src/vscode/integration/claude-code-integrator.ts (Detect if Claude Code panel is open, identify active sessions, modify Claude Code configuration files, trigger panel reload/reopen, verify reload success - FR-011, FR-016)
- [ ] T053 [P] [US2] Implement configuration file templates in src/vscode/integration/claude-code-integrator.ts (Generate Claude Code configuration with endpoint URL and auth token, support different Claude Code config formats/settings.json, user settings, environment configuration)
- [ ] T054 [P] [US2] Implement panel reload orchestration in src/vscode/integration/claude-code-integrator.ts (Sequence: check panel state → prompt user → update configuration → close panel → wait → open panel → verify new endpoint, handle reload failures with graceful degradation, retry logic)
- [ ] T055 [P] [US2] Implement session prompt UI in src/vscode/ui/endpoints/session-prompt.ts (Show dialog with options when active session detected: "(1) Continue session with reload: Close and reopen panel with new endpoint, preserve conversation state", "(2) Keep current session unchanged: Switch endpoint applies to next session", "(3) Start new session: Close current session and start fresh with new endpoint")
- [ ] T056 [P] [US2] Implement endpoint picker UI in src/vscode/ui/endpoints/endpoint-picker.ts (QuickPick dialog showing available endpoints with URL, connectivity status, label, models with aliases, highlight currently active endpoint)
- [ ] T057 [US2] Implement routing-commands.ts in src/vscode/commands/routing-commands.ts (Commands: selectActiveEndpoint, reloadPanel with mode: continue/new-session, handle user prompts, orchestrate reload flow via Claude Code integrator)
- [ ] T058 [US2] Implement status bar indicator in src/vscode/integration/status-bar.ts (Display active endpoint with label, connectivity status badge: green=connected, yellow=untested, red=unreachable, click to open endpoint picker - FR-014)
- [ ] T059 [US2] Add error handling for reload failures in src/vscode/integration/claude-code-integrator.ts (Handle panel that cannot be programmatically restarted: show user instructions to manually close/reopen panel, detect if user manually reopens panel, verify new endpoint after restart - edge cases)
- [ ] T060 [US2] Add configuration conflict detection in src/vscode/integration/claude-code-integrator.ts (Detect if Claude Code config was manually edited by user, offer overwrite/merge/abort options, handle concurrent configuration changes)
- [ ] T061 [US2] Update extension.ts to register routing commands and status bar in src/vscode/extension.ts (Register claudeSwitcher.selectActiveEndpoint, claudeSwitcher.reloadPanel, claudeSwitcher.showEndpointPicker, status bar item)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work. Endpoint switching with panel reload is fully functional, complete with session management, prompt UI, and graceful error handling.

---

## Phase 5: User Story 3 - View endpoint status and connectivity (Priority: P2)

**Goal**: Developers can see the currently active endpoint and view connectivity status of all configured endpoints through status bar and endpoint picker.

**Independent Test**: A developer views the status bar showing the active endpoint with connectivity badge. Clicking opens the endpoint picker showing all endpoints with URL, connectivity status, and models. User triggers manual connectivity check and sees updated status with latency information if reachable.

### Unit Tests for User Story 3 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T062 [P] [US3] Status bar update logic in tests/unit/core/routing/routing-engine.test.ts
- [ ] T063 [P] [US3] Endpoint picker data preparation in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T064 [P] [US3] Manual connectivity check trigger in tests/unit/core/status/status-tracker.test.ts

### Integration Tests for User Story 3 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T065 [P] [US3] Status bar display and updates in tests/integration/vscode/status-bar.test.ts
- [ ] T066 [P] [US3] Endpoint picker UI display in tests/integration/ui/endpoint-picker.test.ts
- [ ] T067 [P] [US3] List endpoints command in tests/integration/vscode/extension.test.ts
- [ ] T068 [P] [US3] Manual connectivity check command in tests/integration/vscode/extension.test.ts

### Implementation for User Story 3

- [ ] T069 [P] [US3] Implement status bar updates in src/vscode/integration/status-bar.ts (Update on active endpoint change, update on connectivity status change, update on endpoint configuration addition/removal - FR-014, FR-020)
- [ ] T070 [P] [US3] Implement endpoint picker data preparation in src/vscode/ui/endpoints/endpoint-picker.ts (Prepare endpoint list with id, url, label, hasAuth, status, models [name, alias], isActive flag - FR-022, FR-023)
- [ ] T071 [P] [US4] Implement list endpoints command in src/vscode/commands/endpoint-commands.ts (Command: listEndpoints - return all endpoints with status, no network calls, use cached status - FR-021, FR-023)
- [ ] T072 [US3] Implement check connectivity command in src/vscode/commands/endpoint-commands.ts (Command: checkConnectivity - perform manual connectivity check, return status including latency if successful, update status tracker - FR-024)
- [ ] T073 [US3] Update extension.ts to register status and endpoint list commands in src/vscode/extension.ts (Register claudeSwitcher.listEndpoints, claudeSwitcher.checkConnectivity, claudeSwitcher.showEndpointPicker)

**Checkpoint**: At this point, all three user stories work. Developers can configure endpoints, switch active endpoints with panel reload, and view comprehensive status information.

---

## Phase 6: Configuration Export/Import (Priority: P2)

**Goal**: Developers can export endpoint configuration (auth tokens excluded) and import configuration for team sharing or backup.

**Independent Test**: A developer exports endpoint configuration to JSON (auth tokens excluded). Another developer imports the configuration; endpoints are loaded but auth tokens are marked as needing configuration. User fills in missing tokens and endpoints become active.

### Unit Tests for User Story 4 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T074 [P] [US4] Export configuration with auth token exclusion in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T075 [P] [US4] Import configuration with ID remapping in tests/unit/core/endpoints/endpoint-registry.test.ts
- [ ] T076 [P] [US4] Conflict detection during import in tests/unit/core/endpoints/endpoint-registry.test.ts

### Integration Tests for User Story 4 (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T077 [P] [US4] Export config command in tests/integration/vscode/extension.test.ts
- [ ] T078 [P] [US4] Import config command in tests/integration/vscode/extension.test.ts
- [ ] T079 [P] [US4] Auth token configuration dialog after import in tests/integration/ui/endpoint-editor.test.ts

### Implementation for User Story 4

- [ ] T080 [P] [US4] Implement export configuration in src/core/endpoints/endpoint-registry.ts (Export endpoints with URLs, labels, models, EXCLUDE auth tokens, validate user understands auth tokens will not be included, write to clipboard or specified path - FR-045)
- [ ] T081 [P] [US4] Implement import configuration in src/core/endpoints/endpoint-registry.ts (Load from clipboard or path, validate URLs, generate new IDs for imported endpoints, mark endpoints requiring auth, detect conflicts with existing endpoints)
- [ ] T082 [P] [US4] Implement conflict resolution in src/core/endpoints/endpoint-registry.ts (Detect URL/label conflicts, offer overwrite/skip/rename options, handle merge scenarios)
- [ ] T083 [US4] Implement import-commands.ts in src/vscode/commands/import-commands.ts (Commands: exportConfig, importConfig with confirmOverwrite flag, show auth token configuration dialog after import for endpoints needing tokens)
- [ ] T084 [US4] Update extension.ts to register import/export commands in src/vscode/extension.ts (Register claudeSwitcher.exportConfig, claudeSwitcher.importConfig)

**Checkpoint**: At this point, configuration export/import is functional. All core features (US1, US2, US3) plus configuration sharing (US4) work.

---

## Phase 7: Polish and Debugging (Priority: P3)

**Goal**: Comprehensive error handling, diagnostics, and user experience polish.

### Unit Tests for Polish (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T085 [P] [Polish] Error code standardization in tests/unit/utils/logger.test.ts
- [ ] T086 [P] [Polish] Retry logic with exponential backoff in tests/unit/utils/retry.test.ts
- [ ] T087 [P] [Polish] Edge case handling (invalid URLs, missing tokens, unreachable endpoints) in tests/unit/core/endpoints/endpoint-registry.test.ts

### Integration Tests for Polish (Mandatory TDD - Write First, Ensure They Fail)

- [ ] T088 [P] [Polish] Error display with actionable messages in tests/integration/vscode/extension.test.ts
- [ ] T089 [P] [Polish] Run diagnostics command in tests/integration/vscode/extension.test.ts
- [ ] T090 [P] [Polish] Telemetry and logging verification in tests/integration/vscode/extension.test.ts

### Implementation for Polish

- [ ] T091 [P] [Polish] Implement standardized error codes in src/vscode/commands/ (Error codes: ENDPOINT_INVALID_URL, ENDPOINT_NOT_FOUND, ENDPOINT_IN_USE, NO_ENDPOINTS_CONFIGURED, AUTH_TOKEN_MISSING, NETWORK_ERROR, UNREACHABLE, PANEL_RELOAD_FAILED, etc. - include retryable flag)
- [ ] T092 [P] [Polish] Implement retry logic with exponential backoff in src/utils/retry.ts (Retry connectivity failures with increasing delays, configurable max retries and timeout)
- [ ] T093 [P] [Polish] Implement error message redaction in src/utils/crypto-utils.ts (Redact auth tokens and secrets in error messages, use [REDACTED] or hash identifiers)
- [ ] T094 [P] [Polish] Implement run diagnostics command in src/vscode/commands/diagnostics-commands.ts (Check all configured endpoints, report connectivity status, detect configuration conflicts, validate models, summary of issues)
- [ ] T095 [US5] Implement comprehensive error handling in all commands (Provide clear error messages with actionable suggestions, include error codes for programmatic handling, log errors with context without secrets)
- [ ] T096 [US5] Add telemetry and audit logging (optional) (Log successful operations, endpoint switches, configuration changes without sensitive data for debugging)

**Checkpoint**: Complete, production-ready extension with comprehensive error handling, diagnostics, and polished user experience.

---

## Phase 8: Documentation and Testing Coverage

**Goal**: Complete documentation and comprehensive test coverage.

- [ ] T097 Write README.md with installation and usage instructions
- [ ] T098 Write CHANGELOG.md documenting all features and API changes
- [ ] T099 Write CONTRIBUTING.md for development setup and contribution guidelines
- [ ] T100 [P] Verify 100% unit test coverage for pure logic modules (Vitest coverage report)
- [ ] T101 [P] Verify integration tests cover all user stories end-to-end (VS Code Test Runner)
- [ ] T102 [P] Performance testing: verify endpoint switching completes in < 1 second (FR-NFR-001)
- [ ] T103 [P] Load testing: verify 20+ endpoints can be configured without performance degradation
- [ ] T104 [P] Security testing: verify auth tokens never logged or exposed in error messages

**Final Deliverable**: Complete VS Code extension with full test coverage, documentation, and all features working as specified.

---

## Summary

- **Total Tasks**: 104
- **User Stories**: 4 (US1-P1, US2-P1, US3-P2, US4-P2)
- **MVP Features**: US1 + US2 (configure endpoints, switch with reload)
- **Critical Path**: Phase 1 (Setup) → Phase 2 (Foundational) → Phase 4 (US2 reload implementation)
- **Parallelizable Tasks**: Marked with [P] can run concurrently once foundational phase completes
