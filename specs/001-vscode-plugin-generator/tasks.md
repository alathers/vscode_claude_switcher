---

description: "Task list for feature implementation"
---

# Tasks: VS Code Model Profile Orchestrator

**Input**: Design documents from `/specs/001-vscode-plugin-generator/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are MANDATORY per spec - this project requires dual testing strategy (Vitest for pure logic, VS Code integration tests for extension behavior)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source code**: `src/` (pure logic in `src/core/`, VS Code integration in `src/vscode/`)
- **Tests**: `tests/unit/` (Vitest), `tests/integration/` (VS Code Test Runner)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure: src/core/(state/, policy/, adapters/, validation/, handoff/, audit/), src/vscode/(configuration/, ui/, commands/, integration/), src/utils/, tests/unit/, tests/integration/
- [x] T002 Initialize TypeScript project with VS Code Extension API dependencies (vsce, @types/vscode)
- [x] T003 [P] Configure TypeScript strict mode in tsconfig.json (compilerOptions.strict = true)
- [x] T004 [P] Configure ESLint for TypeScript with recommended rules
- [x] T005 [P] Configure Vitest for unit tests in vitest.config.ts
- [x] T006 [P] Configure VS Code Test Runner for integration tests
- [x] T007 Create .vscodeignore to exclude tests and development files from VSIX
- [x] T008 Create package.json base structure with manifests (activationEvents, contributes.commands, contributes.views)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Pure Logic Utilities (No VS Code API Dependencies)

- [x] T009 [P] Create path-normalizer.ts in src/utils/path-normalizer.ts - Platform-agnostic path handling using path, os.homedir(), vscode.Uri (no VS Code API imports)
- [x] T010 [P] Create logger.ts in src/utils/logger.ts - Core logger with redaction support, no VS Code API imports
- [x] T011 [P] Create crypto-utils.ts in src/utils/crypto-utils.ts - Hash and redaction helpers for secrets (no VS Code API imports)
- [x] T012 [P] Create retry.ts in src/utils/retry.ts - Retry logic for endpoint checks, no VS Code API imports

### Core State Management (Pure Logic)

- [x] T013 Create profile-registry.ts in src/core/state/profile-registry.ts - Profile loading from YAML, merging defaults, validation logic (no VS Code API imports)
- [x] T014 [P] Create state-machine.ts in src/core/state/state-machine.ts - Activation state transitions, handoff state machine logic (no VS Code API imports)
- [x] T015 [P] Create activity-tracker.ts in src/core/state/activity-tracker.ts - Concurrent session tracking, conflict detection logic (no VS Code API imports)

### Policy Engine (Pure Logic)

- [x] T016 Create policy-engine.ts in src/core/policy/policy-engine.ts - Privacy mode enforcement, request classification (model-provider vs. supporting network), routing decisions (no VS Code API imports)
- [x] T017 [P] Create policy-parser.ts in src/core/policy/policy-parser.ts - Workspace policy YAML parsing, validation logic (no VS Code API imports)
- [x] T018 [P] Create guard-distributor.ts in src/core/policy/guard-distributor.ts - Approval flow, timeout tracking, multi-approver logic (no VS Code API imports)

### Adapter Interface (Pure Logic)

- [ ] T019 Create contract.ts in src/core/adapters/contract.ts - Adapter abstract interface with capability declarations (streaming, tools, fileEdits, commands, modelDiscovery, transcriptObservable), no VS Code API imports
- [ ] T020 [P] Create native-claude.ts stub in src/core/adapters/native-claude.ts - Claude Code CLI + config manipulation interface stub (implementation in integration layer)
- [ ] T021 [P] Create anthropic-compatible.ts stub in src/core/adapters/anthropic-compatible.ts - Anthropic-compatible HTTP API adapter stub
- [ ] T022 [P] Create openai-compatible.ts stub in src/core/adapters/openai-compatible.ts - OpenAI-compatible HTTP API adapter stub
- [ ] T023 [P] Create ollama.ts stub in src/core/adapters/ollama.ts - Ollama HTTP API adapter stub
- [ ] T024 [P] Create generic-command.ts stub in src/core/adapters/generic-command.ts - Shell command with sanitized environment adapter stub

### Validation Logic (Pure Logic)

- [ ] T025 Create profile-validator.ts in src/core/validation/profile-validator.ts - Schema validation, policy compatibility, endpoint reachability checks (no VS Code API imports)
- [ ] T026 [P] Create capability-checker.ts in src/core/validation/capability-checker.ts - Adapter capability validation vs. adapter declarations (no VS Code API imports)
- [ ] T027 [P] Create secret-resolution.ts in src/core/validation/secret-resolution.ts - Secret reference validation logic (VS Code SecretStorage access isolated in vscode layer)

### Handoff Logic (Pure Logic)

- [ ] T028 Create summarizer.ts in src/core/handoff/summarizer.ts - Local summarizer, deterministic outline fallback (no VS Code API imports)
- [ ] T029 [P] Create transcript-oracle.ts in src/core/handoff/transcript-oracle.ts - Transcript retrieval via adapters interface (no VS Code API imports)
- [ ] T030 [P] Create handoff-serializer.ts in src/core/handoff/handoff-serializer.ts - Handoff packet creation, metadata tracking (no transcript/summary content storage) (no VS Code API imports)

### Audit Logging (Pure Logic)

- [ ] T031 Create audit-writer.ts in src/core/audit/audit-writer.ts - Audit log writing without prohibited content (no prompts, transcript, code, tokens, secrets stored) (no VS Code API imports)
- [ ] T032 [P] Create redaction-engine.ts in src/core/audit/redaction-engine.ts - Secret and internal content redaction logic (no VS Code API imports)

### VS Code Integration Layer (All VS Code API Access Isolated Here)

- [ ] T033 Create workspace-scoped.ts in src/vscode/configuration/workspace-scoped.ts - VS Code workspace configuration read/write (isolates VS Code API access)
- [ ] T034 [P] Create secret-storage.ts in src/vscode/configuration/secret-storage.ts - VS Code SecretStorage wrapper (isolates VS Code API access)
- [ ] T035 [P] Create file-manager.ts in src/vscode/configuration/file-manager.ts - VS Code fs access adapter (isolates VS Code API access)

### Extension Entry Point

- [ ] T036 Create extension.ts in src/vscode/extension.ts - Extension activation/deactivation, command registration (all VS Code API access here)

### Unit Tests for Foundational Logic (Mandatory per Constitution)

- [x] T037 [P] Test profile-registry.ts in tests/unit/core/state/profile-registry.test.ts
- [x] T038 [P] Test state-machine.ts in tests/unit/core/state/state-machine.test.ts
- [x] T039 [P] Test activity-tracker.ts in tests/unit/core/state/activity-tracker.test.ts
- [x] T040 [P] Test policy-engine.ts in tests/unit/core/policy/policy-engine.test.ts
- [x] T041 [P] Test policy-parser.ts in tests/unit/core/policy/policy-parser.test.ts
- [x] T042 [P] Test guard-distributor.ts in tests/unit/core/policy/guard-distributor.test.ts
- [ ] T043 [P] Test adapter contract.ts in tests/unit/core/adapters/contract.test.ts
- [ ] T044 [P] Test profile-validator.ts in tests/unit/core/validation/profile-validator.test.ts
- [ ] T045 [P] Test capability-checker.ts in tests/unit/core/validation/capability-checker.test.ts
- [ ] T046 [P] Test secret-resolution.ts in tests/unit/core/validation/secret-resolution.test.ts
- [ ] T047 [P] Test summarizer.ts in tests/unit/core/handoff/summarizer.test.ts
- [ ] T048 [P] Test transcript-oracle.ts in tests/unit/core/handoff/transcript-oracle.test.ts
- [ ] T049 [P] Test handoff-serializer.ts in tests/unit/core/handoff/handoff-serializer.test.ts
- [ ] T050 [P] Test audit-writer.ts in tests/unit/core/audit/audit-writer.test.ts
- [ ] T051 [P] Test redaction-engine.ts in tests/unit/core/audit/redaction-engine.test.ts
- [ ] T052 [P] Test utils/path-normalizer.ts in tests/unit/utils/path-normalizer.test.ts
- [ ] T053 [P] Test utils/logger.ts in tests/unit/utils/logger.test.ts
- [ ] T054 [P] Test utils/crypto-utils.ts in tests/unit/utils/crypto-utils.test.ts
- [ ] T055 [P] Test utils/retry.ts in tests/unit/utils/retry.test.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Select and activate a profile (Priority: P1) 🎯 MVP

**Goal**: Developers can select workspace default profiles from available profiles (user-level, repository templates), see resolved configuration (provider, model, trust zone), and have profile activate without restarting VS Code. Secret references validate before activation.

**Independent Test**: A developer can open a trusted workspace with a repository template and user profile overlay, select from available profiles through command palette or status bar, see the resolved provider, model, trust zone, and capability state, and have the profile immediately active. Missing secret references block activation with redacted actionable diagnostics.

### Unit Tests for User Story 1 (Mandatory - Write First, Ensure They Fail)

- [ ] T056 [P] [US1] Profile loading from user directory ~/.claude-claude-switcher/profiles/ in tests/unit/core/state/profile-registry.test.ts
- [ ] T057 [P] [US1] Profile template overlay merging (repository template + user overlay) in tests/unit/core/state/profile-registry.test.ts
- [ ] T058 [P] [US1] Secret reference validation check in tests/unit/core/validation/secret-resolution.test.ts
- [ ] T059 [P] [US1] Profile activation state transition validation in tests/unit/core/state/state-machine.test.ts
- [ ] T060 [P] [US1] Schema validation for profile YAML (including credential.secretRef null for templates) in tests/unit/core/validation/profile-validator.test.ts

### Integration Tests for User Story 1 (Mandatory - Write First, Ensure They Fail)

- [ ] T061 [P] [US1] Profile selection command registration in tests/integration/vscode/extension.test.ts
- [ ] T062 [P] [US1] Profile activation via command palette in tests/integration/ui/profile-selector.test.ts
- [ ] T063 [P] [US1] Profile activation via status bar selector in tests/integration/vscode/status-bar.test.ts
- [ ] T064 [P] [US1] Secret reference validation with VS Code SecretStorage in tests/integration/vscode/secret-storage.test.ts
- [ ] T065 [P] [US1] Profile template overlay from .claude-switcher/templates/ in tests/integration/vscode/configuration.test.ts

### Implementation for User Story 1

- [ ] T066 [P] [US1] Implement profile selector UI in src/vscode/ui/profiles/profile-selector.ts (QuickPick dialog displaying available profiles with adapter, model, trust zone indicators)
- [ ] T067 [P] [US1] Implement profile editor UI in src/vscode/ui/profiles/profile-editor.ts (Basic profile creation/editing form, secret reference input field)
- [ ] T068 [US1] Implement profile-commands.ts in src/vscode/commands/profile-commands.ts (Commands: selectProfile, selectProfileOverride, createProfile, duplicateProfile, deleteProfile, validateProfile)
- [ ] T069 [US1] Implement secret-storage.ts integration in src/vscode/configuration/secret-storage.ts (Wrap vscode.ExtensionContext.secrets, provide getSecret, setSecret, deleteSecret, listSecrets methods)
- [ ] T070 [US1] Implement profile loading with template overlay in src/core/state/profile-registry.ts (Load user profiles from ~/.claude-claude-switcher/profiles/, merge with repository templates from .claude-switcher/templates/)
- [ ] T071 [US1] Implement profile activation state machine in src/core/state/state-machine.ts (State transition: draft → validated → active, handle missing secrets, rollback on failure)
- [ ] T072 [US1] Implement profile validation in src/core/validation/profile-validator.ts (Schema compliance, policy compatibility, secret reference existence, endpoint reachability check)
- [ ] T073 [US1] Implement status bar indicator in src/vscode/integration/status-bar.ts (Display active profile with color-coded badge: green=local, yellow=private-network, orange=cloud, error=invalid)
- [ ] T074 [US1] Add audit logging for profile selection and activation in src/core/audit/audit-writer.ts (Log events: profile-selected, profile-validation-failed, with profile ID, timestamp, no secrets)
- [ ] T075 [US1] Add redaction for secret references in error messages in src/vscode/commands/profile-commands.ts (Replace secret values with hash identifiers or [REDACTED] in all user-facing error messages)
- [ ] T076 [US1] Update extension.ts to register profile commands and status bar in src/vscode/extension.ts (Register claudeSwitcher.selectProfile, claudeSwitcher.createProfile, claudeSwitcher.validateProfile, status bar item)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently. Developers can select and activate profiles, see resolved configuration, and missing secrets block with clear diagnostics.

---

## Phase 4: User Story 2 - Switch profiles with handoff (Priority: P1)

**Goal**: Developers can switch between different AI model profiles during an open VS Code session, optionally transferring conversation context between providers with explicit control over what gets transferred (full transcript, reviewed summary, or no-context).

**Independent Test**: A developer with an active conversation selects a different profile through status bar or command palette, sees handoff options (full transcript, reviewed summary, no-context), views recommended mode based on trust-zone combination, configures summary fields (include code, sensitive data, tool output, diffs, command output, paths), selects handoff mode, and context transfers to new profile.

### Unit Tests for User Story 2 (Mandatory - Write First, Ensure They Fail)

- [ ] T077 [P] [US2] Handoff mode selection logic (full/summary/none) in tests/unit/core/state/state-machine.test.ts
- [ ] T078 [P] [US2] Summary generation with field inclusion/exclusion logic in tests/unit/core/handoff/summarizer.test.ts
- [ ] T079 [P] [US2] Transcript retrieval via adapter in tests/unit/core/handoff/transcript-oracle.test.ts
- [ ] T080 [P] [US2] Handoff metadata creation (metadata only, no content) in tests/unit/core/handoff/handoff-serializer.test.ts

### Integration Tests for User Story 2 (Mandatory - Write First, Ensure They Fail)

- [ ] T081 [P] [US2] Profile switching command in tests/integration/vscode/extension.test.ts
- [ ] T082 [P] [US2] Handoff dialog UI in tests/integration/ui/handoff-dialog.test.ts
- [ ] T083 [P] [US2] Summary editor UI for field configuration in tests/integration/ui/summary-editor.test.ts
- [ ] T084 [P] [US2] End-to-end profile switching flow in tests/integration/end-to-end.test.ts

### Implementation for User Story 2

- [ ] T085 [P] [US2] Implement handoff state machine transitions in src/core/state/state-machine.ts (States: active → switching → active or terminated, handle handoff completion, failure, cancellation)
- [ ] T086 [P] [US2] Implement local summarizer in src/core/handoff/summarizer.ts (Summarize conversation, exclude code and sensitive data by default, support field inclusion configuration: includeCode, includeSensitiveData, includeToolOutput, includeDiffs, includeCommandOutput, includePaths)
- [ ] T087 [P] [US2] Implement transcript retrieval oracle in src/core/handoff/transcript-oracle.ts (Call adapter.getTranscript() if capabilities.transcriptObservable is true, handle unsupported capability gracefully with user error message)
- [ ] T088 [P] [US2] Implement handoff serialization in src/core/handoff/handoff-serializer.ts (Create handoff metadata packet with handoffId, sourceSessionId, destinationProfileId, mode, timestamp; DO NOT store transcript or summary content, only fields included in metadata)
- [ ] T089 [US2] Implement handoff dialog UI in src/vscode/ui/handoff/handoff-dialog.ts (Display three handoff options: full transcript, reviewed summary, no context; highlight recommended mode based on trust-zone combination; for summary mode, show field inclusion configuration checkboxes with defaults: includeCode=false, includeSensitiveData=false, includeToolOutput=false, includeDiffs=false, includeCommandOutput=false, includePaths=true)
- [ ] T090 [P] [US2] Implement summary editor UI in src/vscode/ui/handoff/summary-editor.ts (UI to review and customize summary fields before handoff, show preview of what will be included)
- [ ] T091 [US2] Implement handoff-commands.ts in src/vscode/commands/handoff-commands.ts (Commands: switchProfile, exportHandoffPackage, deleteHandoffMetadata; handle full transcript handoff via adapter, summary generation via local summarizer, no-context mode activates new profile without context transfer)
- [ ] T092 [US2] Add audit logging for handoff operations in src/core/audit/audit-writer.ts (Log events: handoff-initiated, handoff-completed, handoff-failed, handoff-exported; include metadata: handoffId, sourceProfileId, destinationProfileId, mode, userApproval; DO NOT log transcript or summary content)
- [ ] T093 [US2] Update extension.ts to register handoff commands in src/vscode/extension.ts (Register claudeSwitcher.switchProfile, claudeSwitcher.exportHandoffPackage, claudeSwitcher.deleteHandoffMetadata)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently. Profile switching with handoff (full transcript, summary, or no-context) is functional.

---

## Phase 5: User Story 3 - Control privacy and routing policy (Priority: P1)

**Goal**: Teams can enforce privacy boundaries for coding-agent sessions, particularly restricting direct disclosure of workspace data to cloud model providers while supporting necessary supporting network operations (web research, source control, package/docs access). Privacy modes: unrestricted (automatic approval), guarded (explicit approval required), strict (blocked until policy change).

**Independent Test**: A workspace administrator sets privacy mode (unrestricted, guarded, or strict) via policy editor, attempts a cloud model request through a profile, and observes the appropriate behavior (automatic approval for unrestricted, explicit approval prompt for guarded, blocked with error for strict mode). Supporting network operations (web research, source control, package/docs access) remain allowed unless separate policy restricts them.

### Unit Tests for User Story 3 (Mandatory - Write First, Ensure They Fail)

- [ ] T094 [P] [US3] Request classification (model-provider vs. supporting network) in tests/unit/core/policy/policy-engine.test.ts
- [ ] T095 [P] [US3] Privacy mode enforcement (unrestricted, guarded, strict) in tests/unit/core/policy/policy-engine.test.ts
- [ ] T096 [P] [US3] Approval flow logic (guard-distributor) in tests/unit/core/policy/guard-distributor.test.ts
- [ ] T097 [P] [US3] Auto-revert timeout logic in tests/unit/core/policy/guard-distributor.test.ts
- [ ] T098 [P] [US3] Policy change validation (requireConfirmation, requireReason, requireSecondApprover) in tests/unit/core/policy/policy-parser.test.ts

### Integration Tests for User Story 3 (Mandatory - Write First, Ensure They Fail)

- [ ] T099 [P] [US3] Policy editor UI in tests/integration/ui/policy-editor.test.ts
- [ ] T100 [P] [US3] Cloud request approval flow in tests/integration/vscode/extension.test.ts
- [ ] T101 [P] [US3] Policy change confirmation dialogs in tests/integration/ui/policy-editor.test.ts

### Implementation for User Story 3

- [ ] T102 [P] [US3] Implement policy engine request classifier in src/core/policy/policy-engine.ts (Classify requests: model-provider (direct cloud API call) vs. supporting network (web research, source control, package/docs access) - FR-040)
- [ ] T103 [P] [US3] Implement privacy mode enforcement in src/core/policy/policy-engine.ts (Unrestricted mode: allow requests automatically; Guarded mode: require explicit approval via approveCloudRequest command; Strict mode: block requests before transmitting data - FR-041, FR-042)
- [ ] T104 [P] [US3] Implement guard distributor for approval flow in src/core/policy/guard-distributor.ts (Track pending cloud requests, store approval with metadata, support auto-revert timeout, support requireSecondApprover when configured)
- [ ] T105 [P] [US3] Implement policy parser for workspace policy YAML in src/core/policy/policy-parser.ts (Parse .claude-switcher/policy.yaml, validate privacy.handoff.defaultMode ∈ privacy.handoff.allowedModes, validate profiles.allowedTemplateIds reference existing templates)
- [ ] T106 [P] [US3] Implement policy editor UI in src/vscode/ui/privacy/policy-editor.ts (Edit privacy mode, configure handoff defaults (allowedModes, defaultMode, summaryDefault fields), configure concurrency rules (default, conflictAction, supportsWorktrees, checkpointBeforeMutation), configure profile governance (allowedTemplateIds))
- [ ] T107 [US3] Implement policy-commands.ts in src/vscode/commands/policy-commands.ts (Commands: setPrivacyMode, approveCloudRequest, denyCloudRequest, showPolicyEditor; handle privacy mode changes with requireConfirmation, requireReason, revertAfterMinutes, requireSecondApprover)
- [ ] T108 [US3] Add audit logging for policy operations in src/core/audit/audit-writer.ts (Log events: policy-changed, cloud-request-approved, cloud-request-denied; include previousMode, newMode, reason, requestId, destination; DO NOT log request content)
- [ ] T109 [US3] Update extension.ts to register policy commands in src/vscode/extension.ts (Register claudeSwitcher.setPrivacyMode, claudeSwitcher.approveCloudRequest, claudeSwitcher.denyCloudRequest, claudeSwitcher.showPolicyEditor)

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work. Privacy policy enforcement (unrestricted, guarded, strict modes) is functional for cloud model requests while allowing supporting network operations.

---

## Phase 6: User Story 4 - Manage concurrent agents (Priority: P2)

**Goal**: Advanced users running multiple AI coding agents simultaneously see visibility into concurrent activity (activity ledger displaying profile, state, known files/commands, recent changes), receive warnings about potential conflicts, and can enable optional safeguards (exclusive writer, worktree isolation, checkpoints) to prevent overlapping modifications.

**Independent Test**: A developer starts multiple sessions (simulated), sees an activity ledger displaying profile (with provider class badge), state (initializing, active, idle, switching, terminated), known files, commands, and recent changes for each session. When two sessions indicate overlapping edits on the same file, a conflict warning appears with yellow or red indicator indicating conflict risk (medium or high). Right-clicking on conflict row provides options: "View Conflicting Files", "Open Diff", "Take Over File". Options to enable safeguards: exclusive-writer mode (blocks other sessions), worktree isolation (creates git worktree), checkpoint-before-mutation (creates checkpoint before edit).

### Unit Tests for User Story 4 (Mandatory - Write First, Ensure They Fail)

- [ ] T110 [P] [US4] Activity tracker session registration in tests/unit/core/state/activity-tracker.test.ts
- [ ] T111 [P] [US4] Conflict detection based on overlapping file paths in tests/unit/core/state/activity-tracker.test.ts
- [ ] T112 [P] [US4] Conflict risk level calculation (low/medium/high) in tests/unit/core/state/activity-tracker.test.ts

### Integration Tests for User Story 4 (Mandatory - Write First, Ensure They Fail)

- [ ] T113 [P] [US4] Activity ledger view in tests/integration/ui/activity-ledger.test.ts
- [ ] T114 [P] [US4] Conflict warning notification UI in tests/integration/ui/conflict-warning.test.ts
- [ ] T115 [P] [US4] Session tracking integration tests in tests/integration/vscode/extension.test.ts

### Implementation for User Story 4

- [ ] T116 [P] [US4] Implement activity tracker session management in src/core/state/activity-tracker.ts (Register session with sessionId, profileId, state, startTime; track activeFiles and activeCommands; track recentChanges; update conflict risk level: low (no overlaps), medium (some overlap), high (significant overlap); per-user only, no cross-user visibility)
- [ ] T117 [P] [US4] Implement conflict detection logic in src/core/state/activity-tracker.ts (Detect overlapping file paths across sessions, calculate conflict risk level, trigger warnings)
- [ ] T118 [US4] Implement activity ledger view in src/vscode/ui/activity/ledger-view.ts (Display table columns: Profile (badge: local/private-network/cloud), State, Files, Commands, Conflict (icon: low/medium/high), Last Active; right-click context menu: "View Conflicting Files", "Open Diff", "Take Over File")
- [ ] T119 [US4] Implement conflict warning notification UI in src/vscode/ui/activity/conflict-warning.ts (Display notification when conflict becomes medium or high risk, show conflicting session information, provide action buttons: "View Details", "Take Over File", "Dismiss")
- [ ] T120 [US4] Implement optional safeguards in src/vscode/commands/profile-commands.ts (Policy-driven: exclusive-writer mode blocks other session mutations, worktree isolation uses git worktree (FR-063), checkpoint-before-mutation creates configured checkpoint before modification)
- [ ] T121 [US4] Add audit logging for session tracking in src/core/audit/audit-writer.ts (Log events: session-started, session-terminated, conflict-detected; include sessionId, profileId, conflictRisk; DO NOT log file contents or command output)
- [ ] T122 [US4] Update extension.ts to register activity ledger commands in src/vscode/extension.ts (Register claudeSwitcher.showActivityLedger)

**Checkpoint**: At this point, User Stories 1, 2, 3, AND 4 should all work. Concurrent agent activity visibility, conflict warnings, and optional safeguards are functional.

---

## Phase 7: User Story 5 - Validate profiles and diagnostics (Priority: P2)

**Goal**: Developers can validate profile configurations without incurring charges, identify conflicts, and get actionable error messages when configuration is incorrect or incomplete. Default validation avoids billable API calls; deep validation with explicit authorization identifies potential cost and destination before execution.

**Independent Test**: A developer creates a new profile or edits an existing profile, runs validation command, receives immediate feedback on: schema compliance, policy compatibility (allowedTemplateIds in workspace policy), secret references (exists in SecretStorage), endpoint reachability (if healthCheck.url configured, perform GET/POST request - no model calls), declared capabilities (matches adapter capabilities). Validation completes in < 3 seconds (FR-014, SC-004). Deep validation with user authorization shows cost estimate before executing model discovery calls or test prompt send/receive.

### Unit Tests for User Story 5 (Mandatory - Write First, Ensure They Fail)

- [ ] T123 [P] [US5] Schema validation for Profile, ProfileTemplate, WorkspacePolicy YAML in tests/unit/core/validation/profile-validator.test.ts
- [ ] T124 [P] [US5] Policy compatibility check (allowedTemplateIds) in tests/unit/core/validation/profile-validator.test.ts
- [ ] T125 [P] [US5] Secret reference existence check in tests/unit/core/validation/secret-resolution.test.ts
- [ ] T126 [P] [US5] Endpoint reachability health check in tests/unit/core/validation/profile-validator.test.ts
- [ ] T127 [P] [US5] Capability declaration validation vs. adapter actual capabilities in tests/unit/core/validation/capability-checker.test.ts
- [ ] T128 [P] [US5] Deep validation cost estimation in tests/unit/core/validation/profile-validator.test.ts

### Integration Tests for User Story 5 (Mandatory - Write First, Ensure They Fail)

- [ ] T129 [P] [US5] Validate Profile command in tests/integration/vscode/extension.test.ts
- [ ] T130 [P] [US5] Run Diagnostics command in tests/integration/vscode/extension.test.ts
- [ ] T131 [P] [US5] Validation error display with redaction in tests/integration/ui/profile-selector.test.ts

### Implementation for User Story 5

- [ ] T132 [P] [US5] Implement default validation logic (no billable calls) in src/core/validation/profile-validator.ts (FR-071: Schema validation per profile-schema.md, policy compatibility check, secret reference existence validation, endpoint reachability via healthCheck.url GET/POST request, capability declaration validation)
- [ ] T133 [P] [US5] Implement deep validation logic (with explicit user authorization) in src/core/validation/profile-validator.ts (FR-072: Model discovery via adapter.listModels() if capabilities.modelDiscovery, test message send/receive with minimal prompt; UI shows cost estimate before approval; return SUCCESS, DETAILS with cost estimate, destination)
- [ ] T134 [P] [US5] Implement conflicting configuration detection in src/core/validation/profile-validator.ts (FR-073: Detect conflicting inherited endpoint/authentication configuration; redact all secret values in error messages; return error: "Conflicting configuration detected for [field path] - [actionable suggestion]")
- [ ] T135 [P] [US5] Implement run-diagnostics command in src/vscode/commands/validation-commands.ts (Load workspace policy, validate all (or active/default) profiles, collect all errors and warnings together, display results grouped by category: workspace, profiles, policy, secrets)
- [ ] T136 [US5] Update validate-profile command to support deep validation in src/vscode/commands/validation-commands.ts (Add deepValidation boolean parameter; if true, require approved parameter via user confirmation dialog; show cost estimate and destination before executing deep validation)
- [ ] T137 [US5] Add redaction for all validation error messages in src/core/audit/redaction-engine.ts (Replace secrets with `[REDACTED]` or hash identifier; show field paths but not values)
- [ ] T138 [US5] Update extension.ts to register validation commands in src/vscode/extension.ts (Register claudeSwitcher.validateProfile, claudeSwitcher.runDiagnostics)

**Checkpoint**: At this point, User Stories 1, 2, 3, 4, AND 5 should all work. Profile validation (default and deep) provides actionable diagnostics without unnecessary charges or secrets exposure.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T139 [P] Create README.md in repository root (Installation instructions for macOS and Linux, configuration guide, features overview, troubleshooting)
- [ ] T140 [P] Create CHANGELOG.md in repository root (Follow semantic versioning, document user-visible changes for each release)
- [ ] T141 [P] Create .claude-switcher/.gitignore in .claude-switcher/.gitignore (Ignore handoffs/ except for tracking, ignore audit.log in local development, ignore sessions/)
- [ ] T142 [P] Create .claude-switcher/.claudeignore for handoffs/ in .claude-switcher/.claudeignore (Configure handoff metadata retention: max size, expiration, auto-delete)
- [ ] T143 [P] Performance optimization: Ensure profile selection and activation completes in < 10 seconds (SC-001) in src/core/state/profile-registry.ts
- [ ] T144 [P] Performance optimization: Ensure profile switching with handoff (summary and no-context modes) completes in < 5 seconds (SC-002) in src/core/handoff/summarizer.ts
- [ ] T145 [P] Performance optimization: Ensure default profile validation completes in < 3 seconds (SC-004) in src/core/validation/profile-validator.ts
- [ ] T146 [P] Performance optimization: Ensure concurrent agent conflict warnings display within 2 seconds of detection (SC-006) in src/core/state/activity-tracker.ts
- [ ] T147 [P] Performance optimization: Ensure extension activation and profile loading do not increase VS Code startup time by more than 100 milliseconds (SC-007) in src/vscode/extension.ts
- [ ] T148 [P] Air-gapped support: Ensure offline capability for local models (validation passes schema and policy checks; endpoint-reachability checks skipped or marked pending) in src/core/validation/profile-validator.ts
- [ ] T149 [P] Security hardening: Ensure 100% of unauthorized cloud model requests blocked in strict mode before data transmission (SC-003) in src/core/policy/policy-engine.ts
- [ ] T150 [P] Security hardening: Verify no secrets appear in workspace files (.vscode/, .claude-switcher/) (SC-009) - Write utility test script to scan for secrets
- [ ] T151 [P] Code cleanup: Remove TODO markers, consolidate duplicate code, improve error messages clarity
- [ ] T152 Run quickstart.md validation scenarios (Scenarios 1-8) in specs/001-vscode-plugin-generator/quickstart.md (Document validation results, fix any failing scenarios)
- [ ] T153 Run unit tests: `npm test` and verify coverage > 80% for pure logic modules (src/core/ and src/utils/)
- [ ] T154 Run integration tests: Press F5 in VS Code to launch Extension Development Host, test all commands
- [ ] T155 Smoke test checklist: Verify extension loads without errors, status bar items visible, activity ledger opens, policy editor accessible, no errors in "Claude Switcher Errors" output channel, audit log populating, profile files created in ~/.claude-claude-switcher/profiles/, handoff metadata stored in ~/.claude-claude-switcher/handoffs/

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can proceed in dependency order: US1 → US2 → US3 → US4 → US5
  - US2 (handoff) depends on US1 (profile selection/activation)
  - US3 (privacy) can proceed in parallel with US1/US2 (uses shared foundational infrastructure)
  - US4 (concurrency) can proceed after US2 (handoff creates sessions)
  - US5 (validation) can proceed in parallel with US1 after foundational phase
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Depends on US1 completion - Requires profile selection/activation to have profiles to switch between
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Independent of US1, but tests benefit from having US1 profiles available
- **User Story 4 (P2)**: Depends on US2 completion (handoff creates sessions) - Requires active sessions to track in activity ledger
- **User Story 5 (P2)**: Can start after Foundational (Phase 2) - Independent of other stories but benefits from having profiles created by US1

### Within Each User Story

- Tests (unit + integration) MUST be written and FAIL before implementation
- Pure logic modules before VS Code integration layer
- Core logic before UI commands
- Validation logic before feature implementation
- Core implementation before integration and polish

---

## Parallel Opportunities

### Within Setup (Phase 1)

```bash
# All setup tasks can run in parallel:
Task: "Configure TypeScript strict mode in tsconfig.json"
Task: "Configure ESLint for TypeScript"
Task: "Configure Vitest for unit tests"
Task: "Configure VS Code Test Runner"
```

### Within Foundational Phase (Phase 2)

```bash
# Launch all pure logic utilities together:
Task: "Create path-normalizer.ts"
Task: "Create logger.ts"
Task: "Create crypto-utils.ts"
Task: "Create retry.ts"

# Launch all adapter stubs together:
Task: "Create native-claude.ts stub"
Task: "Create anthropic-compatible.ts stub"
Task: "Create openai-compatible.ts stub"
Task: "Create ollama.ts stub"
Task: "Create generic-command.ts stub"

# Launch all unit tests for foundational logic together (50+ tests can run in parallel)
```

### Within User Story 1 (US1)

```bash
# Launch all unit tests for US1 together:
Task: "Profile loading from user directory"
Task: "Profile template overlay merging"
Task: "Secret reference validation check"
Task: "Profile activation state transition validation"
Task: "Schema validation for profile YAML"

# After tests pass, launch all integration tests for US1 together:
Task: "Profile selection command registration"
Task: "Profile activation via command palette"
Task: "Profile activation via status bar selector"
Task: "Secret reference validation with VS Code SecretStorage"
Task: "Profile template overlay"
```

### Within User Story 2 (US2)

```bash
# Launch all unit tests for US2 together:
Task: "Handoff mode selection logic"
Task: "Summary generation with field inclusion/exclusion"
Task: "Transcript retrieval via adapter"
Task: "Handoff metadata creation"

# After tests pass, launch implementation tasks in parallel:
Task: "Implement handoff state machine transitions"
Task: "Implement local summarizer"
Task: "Implement transcript retrieval oracle"
Task: "Implement handoff serialization"
```

### Within Polish Phase (Phase 8)

```bash
# Launch all documentation tasks together:
Task: "Create README.md"
Task: "Create CHANGELOG.md"

# Launch all performance optimization tasks together:
Task: "Optimize profile selection < 10s"
Task: "Optimize profile switching < 5s"
Task: "Optimize validation < 3s"
Task: "Optimize conflict warnings < 2s"

# Launch all security hardening tasks together:
Task: "Verify strict mode blocks 100%"
Task: "Verify no secrets in workspace files"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only + Foundational)

1. Complete Phase 1: Setup (T001-T008)
2. Complete Phase 2: Foundational (T009-T055) - CRITICAL BLOCKER
3. Complete Phase 3: User Story 1 (T056-T076)
4. **STOP and VALIDATE**: Test User Story 1 independently per quickstart.md Scenario 1 and 2
5. Deploy/demo if ready - MVP complete!

### Incremental Delivery (Recommended)

1. Complete Setup + Foundational → Foundation ready (Day 1-3)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! - Day 4-6)
3. Add User Story 3 → Test independently → Deploy/Demo (Day 7-9) - Privacy ready
4. Add User Story 2 → Test independently → Deploy/Demo (Day 10-12) - Handoff ready
5. Add User Story 5 → Test independently → Deploy/Demo (Day 13-14) - Validation ready
6. Add User Story 4 → Test independently → Deploy/Demo (Day 15-16) - Concurrency ready
7. Polish Phase 8 → Final release (Day 17-18)

### Parallel Team Strategy

With 2-3 developers:

1. Team completes Setup (Phase 1) together (1 day)
2. Team completes Foundational (Phase 2) together (2-3 days) - CRITICAL BLOCKER
3. Once Foundational done:
   - Developer A: User Story 1 (profile selection/activation) + Foundational tests
   - Developer B: User Story 3 (privacy policy) + Foundational tests
   - Developer C: User Story 5 (validation) + Foundational unit tests
4. After US1 ready:
   - Developer A: User Story 2 (handoff)
   - Developer B: User Story 4 (concurrency, depends on US2)
   - Developer C: Polish documentation, performance, security
5. Stories complete and integrate independently, merge in priority order

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests FAIL before implementing (constitution requirement)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests are MANDATORY per spec and constitution (dual testing strategy: Vitest for pure logic, VS Code integration for extension behavior)
- All pure logic modules (src/core/ and src/utils/) MUST have unit tests (>80% coverage required)
- All VS Code integration MUST have integration tests
- Every bug fix requires regression test (constitution requirement)
- Constitution requires: < 100ms additional VS Code startup time, TypeScript strict mode, platform-agnostic paths, SecretStorage for all secrets, no telemetry by default, specific activation events (no `*`), minimal runtime dependencies

---

## Validation Checklist

Before marking tasks.md complete:

- [ ] ALL tasks follow checklist format: `- [ ] [TaskID] [P?] [Story?] Description with file path`
- [ ] ALL user story tasks have [Story] label (US1, US2, etc.)
- [ ] Setup and Foundational phase tasks do NOT have [Story] labels
- [ ] Each user story has unit tests (marked [P] for parallel execution)
- [ ] Each user story has integration tests (marked [P] for parallel execution)
- [ ] Tests are listed BEFORE implementation (TDD order)
- [ ] Each task includes exact file path
- [ ] Tasks are numbered sequentially from T001
- [ ] All 5 user stories have phases with goals, independent tests, implementation tasks
- [ ] MVP scope clearly identified (US1 + Foundational)
- [ ] Dependencies section accurately reflects task interdependencies
- [ ] Parallel opportunities identified across phases
- [ ] Implementation strategy provides MVP, incremental, and parallel team approaches
