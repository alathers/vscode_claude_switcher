# Technical Research: VS Code Model Profile Orchestrator

**Date**: 2026-10-17
**Purpose**: Document technical decisions, research findings, and rationale for implementation choices

## Research Overview

This research investigates technical questions and patterns needed to implement the VS Code Model Profile Orchestrator extension. Each section documents the decision made, rationale, alternatives considered, and references to best practices.

## 1. VS Code Extension State Management

### Decision: Separation of Pure Logic and VS Code Integration

**What was chosen**: Architect with strict separation between pure logic modules (no VS Code API imports) and VS Code integration layers. Pure logic modules live in `src/core/` and implement business rules, state machines, validation, and policy evaluation. VS Code integration lives in `src/vscode/` and handles commands, UI, configuration I/O, and SecretStorage.

**Rationale**:
- Constitution requires all features to have automated tests
- Pure logic modules can be tested without the extension host overhead (fast, reliable unit tests)
- VS Code integration requires integration tests running in a test instance
- Separation makes logic portable and easier to reason about
- Follows VS Code extension best practices for testability

**Alternatives considered**:
- **Monolithic approach with VS Code API everywhere**: Rejected because testing would require extension host for all tests, slow and less reliable
- **Isolated services with wrapping adapters**: Too much abstraction for a small extension; would add complexity without clear benefit
- **Core library in separate npm package**: Overkill for single-extension use case; adds build complexity

**References**:
- VS Code Extension API Testing Guide: "Separate pure logic from VS Code-specific code for faster unit tests"
- TypeScript strict mode encourages module boundaries through type checking

**Impact**: Architecture is defined in `plan.md` Project Structure; unit test suite will exercise pure logic modules with Vitest, integration tests will use VS Code Test Runner

---

## 2. Claude Code CLI Integration Patterns

### Decision: CLI + Configuration File Manipulation as Primary Mode

**What was chosen**: Use Claude Code CLI executable calls for model discovery, session management, and transcript export where available. For model switching and configuration, manipulate Claude Code's configuration files directly (reading and writing JSON/YAML) via CLI-validated paths when API access is not documented. Any official VS Code extension APIs will be used only if publicly documented and validated for third-party extension use.

**Rationale**:
- Clarification from user: "Claude Code CLI + configuration file manipulation as primary modes"
- Claude Code CLI is well-documented and provides direct programmatic access
- Configuration file manipulation is stable across versions when using validated paths
- Leaves room for future official VS Code extension APIs if they become available
- Fallback gracefully to configuration-guided new sessions when CLI/API mechanisms change

**Alternatives considered**:
- **Exclusive VS Code extension API between extensions**: Rejected because official Claude Code panel may not expose public APIs for third-party extensions; would need architecture refactor if APIs remain closed
- **Spike-first prototyping to discover integration**: Rejected because clarification session already established the approach; spike would delay design without adding clarity
- **Only use Claude Code CLI, no config manipulation**: Too restrictive; some operations (profile persistence, state management) need config file I/O

**References**:
- Claude Code CLI Documentation (expected: `claude --help`, `claude --list-models`, `claude --set-model`)
- VS Code Extension Authoring: Section on "Coding with the CLI" and configuration file schemas

**Open Areas**: Research needed during implementation Phase 2 to:
- Verify Claude Code CLI availability and version sensitivity
- Document exact configuration file locations and formats
- Define safe fallback when CLI is unavailable or returns unexpected results
- Validate atomic write-to-temp-then-rename pattern works for Claude Code configs

**Impact**: Adapter interface defined in `contracts/adapter-interface.md`; Claude Code adapter implementation in `src/core/adapters/native-claude.ts`

---

## 3. Profile Schema Design

### Decision: YAML-Based Multi-Layer Schema with Non-Secret Templates

**What was chosen**: Profiles are YAML files with schema versioning, supporting 4-layer configuration: repository template (committed, non-secret) → user profile overlay (local, non-secret) → secret references (local secret storage, environment, SSH agent) → runtime override (temporary). Schema includes adapter type, model ID, base URL, credential reference mode, tunnel configuration, limits, permissions, network classification, instructions, health check, and capability declarations. Repository templates explicitly forbid secret values, passwords, access tokens, private keys, or personal connection strings.

**Rationale**:
- Clarification from spec: FR-001 through FR-005 define profile management requirements
- YAML is human-readable and version-control friendly for templates
- Multi-layer configuration aligns with existing example_profile.yaml and workspace_policy.yaml
- Secret isolation through references enables team sharing without credential exposure
- Capability declarations allow adapter authors to declare streaming, tool use, file editing, etc.

**Alternatives considered**:
- **JSON schema**: Rejected because JSON lacks comments (important for team-shared templates understanding)
- **Custom binary format**: Rejected because not human-readable, difficult to debug, prevents Git diffs
- **Single flat schema**: Rejected because multi-layer approach enables team defaults with local overrides; simplifies onboarding
- **Inline secrets in templates**: Rejected due to security requirement (FR-005) and constitution (Principle III - Secrets & Privacy)

**Schema Fields** (from FR-003 and FR-021 to FR-023):
- `schemaVersion`: Integer for schema evolution
- `id`: Unique profile identifier
- `label`: Human-readable name
- `adapter`: Provider/protocol (anthropic-compatible, openai-compatible, ollama, generic-command, native-claude)
- `model`: Model identifier
- `baseUrl`: API endpoint URL
- `credential.mode`: none, secretRef, environment, subscription (FR-010)
- `credential.secretRef`: SecretStorage reference
- `tunnel.enabled`: Boolean flag
- `tunnel.sshHostAlias`: ~/.ssh/config alias (FR-013)
- `limits.contextTokens`: Optional integer
- `limits.maxOutputTokens`: Optional integer
- `permissions.mode`: review-only, edit-only, edit-and-command
- `permissions.workspacePaths`: Path restrictions list
- `network.providerClass`: local, private-network, cloud
- `network.supportingNetwork`: allowed, blocked
- `instructions`: Optional model instructions
- `environmentRefs`: Environment variable references list
- `healthCheck.url`: Health check endpoint
- `healthCheck.method`: GET/POST
- `capabilities.streaming`: Boolean
- `capabilities.tools`: Boolean
- `capabilities.fileEdits`: Boolean
- `capabilities.commands`: Boolean
- `capabilities.modelDiscovery`: Boolean
- `capabilities.transcriptObservable`: Boolean

**References**:
- Root workspace `example_profile.yaml` and `workspace_policy.yaml` provided initial schema
- VS Code settings.json patterns for user/workspace scoping
- Kubernetes ConfigMap/Secret separation pattern (team config + credentials)

**Impact**: Schema contract in `contracts/profile-schema.md`; validation logic in `src/core/validation/profile-validator.ts`

---

## 4. Privacy Policy Engine Patterns

### Decision: Multi-Mode Enforcement with Traffic Classification

**What was chosen**: Privacy policy engine supports three modes (unrestricted, guarded, strict). Classifies traffic into two categories: model-provider traffic (direct AI model requests) vs. supporting traffic (web research, source control, package/docs access, other approved operations). Guarded mode blocks model-provider requests to cloud until explicit approval; strict mode blocks all cloud model-provider requests and cloud-bound handoffs until policy changes. Supporting traffic remains allowed by default unless separately restricted. Enforcement applies only to extension-managed requests and sessions (FR-044).

**Rationale**:
- Spec FR-040 through FR-045 define privacy and routing requirements
- Multi-mode approach provides flexibility (unrestricted for public projects, guarded for mixed work, strict for air-gapped)
- Traffic classification enables "least disclosure" (speckit point 4) by allowing supporting operations while blocking model egress
- Scoped enforcement (extension-managed only) prevents interference with other tools or user-initiated workflows
- Configurable confirmation, reason capture, timed reversion, and optional second approval for policy changes (FR-045)

**Alternatives considered**:
- **All-or-nothing blocking**: Too coarse; supporting network operations (docs search, git) shouldn't be blocked when only model egress is restricted
- **Intent-based classification**: Too complex; difficult to reliably distinguish user intent; filename/path-based classification is simpler
- **Only strict mode**: Too restrictive; teams may need guarded mode for transient cloud access while maintaining privacy defaults
- **No classification, block all cloud traffic**: Overprotection; supporting operations are safe but should remain allowed

**Policy Fields** (from workspace_policy.yaml structure):
- `privacy.mode`: unrestricted, guarded, strict
- `privacy.cloudModelRequests.default`: require-confirmation, block, allow
- `privacy.handoff.allowedModes`: List [full, summary, none]
- `privacy.handoff.defaultMode`: One of allowedModes
- `privacy.handoff.summaryDefault`: Fields to include/exclude (code, sensitiveData, toolOutput, diffs, commandOutput, paths)
- `privacy.policyChanges.requireConfirmation`: Boolean
- `privacy.policyChanges.requireReason`: Boolean
- `privacy.policyChanges.revertAfterMinutes`: Optional integer
- `privacy.policyChanges.requireSecondApprover`: Boolean
- `concurrency.default`: concurrent, exclusive-writer
- `concurrency.conflictAction`: warn, block
- `concurrency.supportsWorktrees`: Boolean
- `concurrency.checkpointBeforeMutation`: Boolean
- `profiles.allowedTemplateIds`: List of template IDs

**References**:
- Enterprise network security patterns: "data loss prevention" vs "acceptable use" classification
- OPA (Open Policy Agent) decision pattern for policy evaluation
- Kubernetes NetworkPolicy: pod-to-pod traffic classification analog

**Impact**: Policy engine implementation in `src/core/policy/policy-engine.ts`; policy parser in `src/core/policy/policy-parser.ts`

---

## 5. Adapter Design Patterns

### Decision: Abstract Adapter Interface with Capability Declarations

**What was chosen**: Define abstract adapter interface with methods: `connect()`, `validate()`, `listModels()`, `sendMessage()`, `getFileEdits()`, `executeCommand()`, `getTranscript()` (optional). Each adapter declares capabilities: streaming, tool use, file editing, command execution, model discovery, transcript observability (FR-021). Adapters for version one: native-claude (CLI + config), anthropic-compatible (HTTP), openai-compatible (HTTP), ollama (HTTP), generic-command (shell). Unsupported capabilities are disabled or warned about rather than assumed (FR-022). Generic command profiles run with sanitized profile-specific environment (FR-023).

**Rationale**:
- Single adapter contract enables extension to support multiple providers uniformly
- Capability declarations allow UI to disable unsupported features rather than failing at runtime
- HTTP-based adapters share common patterns (request/response, auth headers) while respecting provider differences
- Generic command adapter enables custom CLI integrations without writing TypeScript adapter code
- Минимizes adaptation effort for new providers in future

**Alternatives considered**:
- **Direct provider-specific implementation**: Rejected because tight coupling would make extension internals complex; adapter interface provides clean separation of concerns
- **Plugin architecture**: Overkill for v1; would add plugin discovery, loading, sandboxing complexity
- **No capability declarations, fail-fast on missing capabilities**: Rejected because UI can't proactively warn users; user experience worse

**Adapter Implementation Patterns**:
- **anthropic-compatible**: HTTP API with Anthropic request/response format, at least v1.0.0 (HTTPS JSON)
- **openai-compatible**: HTTP API with OpenAI chat completions format (OpenAI-compatible endpoints)
- **ollama**: HTTP API to Ollama server (default http://localhost:11434)
- **generic-command**: Shell command execution with sandboxed PATH and environment variables; parses stdout/stderr for responses
- **native-claude**: Claude Code CLI for operations; config file manipulation for state persistence

**Environment Sanitization for Generic Profiles** (FR-023):
- Prepend profile-specific environment (from profile.environmentRefs) to inherited PATH
- Limit to allowed environment variables (exclude sensitive OS env vars unless explicitly referenced)
- Set working directory to safe temp location or project root under user control
- Timeout and resource limits to prevent runaway processes

**References**:
- VS Code Terminal API patterns for command execution
- Language Server Protocol (LSP) client/server pattern analog
- Adapter pattern in GoF Design Patterns
- TypeScript interfaces for polymorphism

**Impact**: Adapter interface contract in `contracts/adapter-interface.md`; implementations in `src/core/adapters/`

---

## 6. Handoff Workflow Patterns

### Decision: Three-Mode Handoff with Local Summarizer Default

**What was chosen**: When switching between profiles with different trust zones, offer three handoff choices: full transcript, reviewed summary, no context (FR-050). Default to reviewed summary excluding code and sensitive data (FR-051). Use locally-configured summarizer by default (primary choice matches spec clarification FR-052), offer source-model generation as opt-in alternative. Deterministic local outline available as fallback. Policy configures whether summaries may include tool calls/results, paths, code snippets, diffs, command output, attachments, and sensitive-content redaction (FR-053). Handoff metadata includes source profile, destination profile, mode, timestamp, summary fields, and optionally transcript hash; full transcript content is not stored (FR-054).

**Rationale**:
- Clarification from user: "Use locally-configured summarizer as default, offer source-model as opt-in alternative"
- Full transcript risks data exposure, especially across trust zones; summary mode reduces footprint by default
- No-context is safest for air-gapped environments meeting the secondary use case
- Local summarizer supports offline and air-gapped scenarios (no cloud dependency)
- Source-model opt-in enables higher-quality summaries when user explicitly chooses and network/cloud is available
- Metadata-only storage avoids storing prohibited content (transcripts, prompts, code, secrets per FR-083)

**Alternatives considered**:
- **Full transcript only**: Rejected because risk of unintended data disclosure across trust zones
- **Summary only (no transcript)**: Rejected because users may want full handoff within same trust zone
- **No-choice, always same mode**: Rejected because privacy requirements vary across projects and trust-zone combinations
- **Source-model summarizer by default**: Rejected because violates air-gapped support and requires cloud dependency; local-first matches clarification

**Handoff Workflow Flow**:
1. User selects destination profile
2. Extension compares source and destination trust zones
3. UI recommends handoff mode based on trust-zone combination:
   - Same trust zone → Full transcript recommended
   - Local → Private/Cloud → Summary recommended
   - Private → Cloud → Summary recommended (with redaction warning)
   - Private/Cloud → Local → Summary recommended (clean-slate)
4. User chooses mode; UI displays preview for summary mode (inclusion fields)
5. If summary: Generate using local summarizer (or source-model if opt-in)
   - Default excludes code, sensitive data, tool output, diffs, command output
   - Policy overrides (field inclusion/ exclusion via workspace_policy.yaml)
   - Redaction engine strips sensitive content (paths, credential refs)
6. If full transcript: Retrieve via adapter's getTranscript() method
7. Handoff packet created with metadata and payload (transcript or summary or empty)
8. Destination profile activated with handoff context
9. Metadata stored locally `~/.claude-claude-switcher/handoffs/[timestamp].json` for audit and recovery

**Summarizer Implementation**:
- **Local summarizer**: User-configured local model (e.g., smaller Ollama model) with deterministic outline fallback
- **Source-model summarizer**: Use source profile's model to generate summary (opt-in, requires network if source is cloud)
- **Deterministic fallback**: Algorithmic outline of topics, file paths changed, commands run, without AI generation
- **Redaction**: Sensitive-content detection based on paths, credential references, policy rules

**References**:
- LLM summarization research: "Understanding Summarization Models" (opinionated, but pattern exists)
- PrivacybyDesign principles: data minimization, least disclosure
- Git cherry-pick/rebase pattern (short context transfer analog)

**Impact**: Handoff implementation in `src/core/handoff/`; UI dialogs in `src/vscode/ui/handoff/`

---

## 7. VS Code SecretStorage Best Practices

### Decision: All Secrets in VS Code SecretStorage with Reference-Based Resolution

**What was chosen**: API keys, local-server secrets, and other user credentials stored exclusively in VS Code SecretStorage. Profile YAML and workspace policy files contain secret references (identifiers), not values. Secret resolution lookup occurs at activation time. SecretStorage scoped to extension (vscode.ExtensionContext.secrets). Credentials never in logs, error messages, or notifications; redacted content replaced with hash identifiers or [REDACTED]. SSH profiles use ~/.ssh/config and OS-managed keys; SSH-agent support for key management (FR-013). Workspace configuration (.vscode files) never contains secrets (FR-014).

**Rationale**:
- Constitution Principle III (Secrets & Privacy): "Any credential, token, or API key MUST be stored only via vscode.ExtensionContext.secrets"
- Secrets never in logs/messages prevents accidental disclosure
- Reference-based resolution enables templates to be repository-committed without credential exposure (FR-005)
- VS Code SecretStorage is encrypted at rest on host OS
- SSH uses established infrastructure (~/.ssh/config, SSH-agent) for key management

**Alternatives considered**:
- **Encrypt secrets and store in workspace files**: Rejected because complex to manage correctly; VS Code SecretStorage is vetted
- **Environment variable only**: Rejected because secrets in env vars may leak to child processes; SecretStorage is scoped to extension
- **Plain text in home directory configs**: Rejected because not encrypted at rest; violates constitution隐私要求
- **No secret references, use inline values in profiles**: Rejected because prevents team template sharing; FR-005 prohibits secrets in templates

**SecretStorage Usage Pattern**:
```typescript
// Storing
await context.secrets.store(`credential:${profileId}`, apiKey);

// Retrieving
const apiKey = await context.secrets.get(`credential:${profileId}`);
if (!apiKey) {
  // Missing secret reference error
}

// Deletion
await context.secrets.delete(`credential:${profileId}`);

// Secret validation (for profile validation)
const secretExists = await context.secrets.get(`credential:${profileId}`) !== undefined;
```

**Redaction Patterns**:
- Log entries containing secrets: Replace with `[REDACTED:${hash(secret)}]`
- Error messages with secret values: Replace with `[SECRET MISSING]` or `[SECRET COLLISION]`
- UI显示: Never show secret values; show reference ID only (e.g., `@api-key:openai-model-a`)
- Audit logs: Never log secret content; log only metadata (profileId, timestamp, action)

**SSH Profile Management**:
- SSH profiles specify alias from ~/.ssh/config; tunnel启用时读取该配置
- Secret credentials are NOT stored (SSH-agent manages keys)
- Environment variable order: profile.environmentRefs → inherited PATH → PATH
- Generic command profiles use sanitized environment; SSH key access via SSH-agent only

**References**:
- VS Code Extension API: SecretStorage docs
- OWASP Key Management Cheat Sheet
- Git's .gitignore and credential.helper patterns (separation of credentials from configs)

**Impact**: SecretStorage wrapper in `src/vscode/configuration/secret-storage.ts`; secret resolution in `src/core/validation/secret-resolution.ts`

---

## 8. Platform-Agnostic Path Handling

### Decision: Node.js path, os.homedir(), and VS Code.Uri for All Path Operations

**What was chosen**: Use Node.js `path` module for path joining, normalization, and parsing. Use `os.homedir()` for home directory resolution. Use `vscode.Uri` for VS Code workspace/file URI operations. No hard-coded path separators (`/` or `\`) or absolute home directory paths (`/Users/username` or `C:\Users\username`). All paths are absolute or workspace-relative, never relative to process.cwd(). Platform tests to verify path correctness on macOS and Linux (未来扩展到 Windows 时).

**Rationale**:
- Constitution Technical Constraints: "Path handling MUST be platform-agnostic (path, os.homedir(), vscode.Uri). Hard-coded separators and home-directory paths are prohibited"
- Node.js cross-platform patterns: `path.join()`, `path.normalize()`, `path.resolve()`, `path.sep`
- VS Code.Uri ensures workspace-relative paths are correctly resolved across operating systems
- Future Windows support not foreclosed by avoiding macOS/Linux-specific patterns

**Alternatives considered**:
- **Hard-coded `/` separators**: Rejected because fails on Windows if added later
- **Environment-specific code (if platform === 'darwin' use '/')**: Rejected because duplicates Node.js built-in logic; harder to maintain
- **Relative paths from process.cwd()**: Rejected because extension may run from different contexts; explicit absolute or workspace-relative is clearer

**Path Resolution Pattern**:
```typescript
import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';

// Home directory (user config location)
const userConfigDir = path.join(os.homedir(), '.claude-claude-switcher');

// Workspace-relative (repository template or policy)
const workspaceTemplatesPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders[0].uri, '.claude-switcher', 'templates');

// Absolute (system integration paths)
const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');

// Filtering by extension
const yamlFiles = await vscode.workspace.findFiles('**/*.{yaml,yml}', '**/node_modules/**');
```

**Tests Needed**:
- Path joining produces correct separator on macOS and Linux (`path.join('a', 'b')` → `'a/b'`)
- `os.homedir()` returns correct home directory regardless of execution context
- VS Code.Uri workspace-relative resolution works across project configurations
- Windows compatibility tests to be added when Windows support is planned

**References**:
- Node.js path module documentation
- VS Code URI documentation
- Cross-platform Node.js patterns: "Writing Cross-Platform Code" (effective 🔗)

**Impact**: Path normalizer utility in `src/utils/path-normalizer.ts`; all file I/O adapters use these utilities

---

## 9. Activation Events and Performance

### Decision: Specific Events Only, Never `*` or `onStartupFinished`

**What was chosen**: Activation on:
- `onCommand` (when user invokes extension commands)
- `workspaceContains:.claude-switcher/**` (when workspace contains .claude-switcher directory with templates or policy)
- `onView` (if adding views, but not used in v1)
Never activate on `*` (any command) or `onStartupFinished` (unless justified and documented). Activation and profile loading overhead < 100ms to VS Code startup time (SC-007). Only load config files and validate files when explicitly needed (profile selection, validation command). Preload minimal metadata for quick access.

**Rationale**:
- Constitution Principle V (Lightweight & Simple): Activation MUST use specific activation events; `*` activation event MUST NOT be used
- Overhead < 100ms is strict performance goal from spec SC-007
- Lazy loading of config files reduces activation overhead
- No speculative configuration knobs without spec use case (YAGNI)

**Alternatives considered**:
- **`*` activation**: Rejected because extension would activate on every command, slowing startup
- **onStartupFinished activation**: Rejected unless justified; would delay VS Code ready time, particularly slow for large workspaces
- **Preload all profiles on activation**: Rejected because may be unnecessary if user never selects a profile; lazy loading better

**Performance Budget**:
- Activation and profile loading: < 100ms total
- Profile selection (from selector UI): < 10s (SC-001 includes network/CLI overhead; selection UI itself fast)
- Profile switching with handoff: < 5s (SC-002 includes summary generation, transcript retrieval, activation)
- Default validation: < 3s with no billable API calls (SC-004)

**Activation Events in package.json**:
```json
{
  "activationEvents": [
    "onCommand:claudeSwitcher.selectProfile",
    "onCommand:claudeSwitcher.createProfile",
    "onCommand:claudeSwitcher.editProfile",
    "onCommand:claudeSwitcher.validateProfile",
    "onCommand:claudeSwitcher.switchProfile",
    "onCommand:claudeSwitcher.setPrivacyMode",
    "workspaceContains:.claude-switcher/templates/**",
    "workspaceContains:.claude-switcher/policy.yaml"
  ]
}
```

**Lazy Loading Pattern**:
- On activation: Load only minimal metadata from repo templates/policy (names, IDs, basic validation)
- On first command requiring full profile: Load and merge full profile YAML (repo template + user overlay)
- Cache resolved profiles in memory during extension lifetime; reload on file change (watch .claude-switcher/**/*.yaml)

**Testing Performance**:
- Use Chrome DevTools in VS Code to measure activation time
- Profile selector UI responsiveness under workspace size (10 files vs 1000 files)
- Validation timing with local profiles (no network) vs cloud profiles (network latency)

**References**:
- VS Code Extension Performance Best Practices: "Activation Events" section
- Constitution Principle V (Lightweight & Simple)

**Impact**: Activation events defined in package.json; performance tests in test suite

---

## 10. Testing Strategy

### Decision: Dual-Test Strategy (Unit + Integration) with Regression Tests

**What was chosen**: All features have automated tests. Pure logic modules (no VS Code API imports) tested with Vitest (fast unit tests). Extension host behavior tested with VS Code Test Runner (integration tests). Every bug fix includes regression test. Test-first workflow encouraged but gate is existence and passing tests.

**Rationale**:
- Constitution Principle IV (Tested Behavior): Every feature MUST ship with automated tests; pure logic in modules without vscode must have fast unit tests; VS Code-dependent behavior must have integration tests
- Pure logic tested without extension host for speed and reliability
- Integration tests validate real VS Code behavior (commands, configuration, status bar)
- Regression tests prevent recurrence of bugs

**Alternatives considered**:
- **Integration tests only**: Rejected because too slow and flaky for comprehensive coverage; unit tests faster and more reliable
- **Unit tests only**: Rejected because can't validate real VS Code API behavior (commands, UI)
- **No regression test requirement**: Rejected because encourages bug recurrence

**Test Tooling**:
- **Unit tests**: Vitest (fast, TypeScript-first, VS Code integration)
- **Integration tests**: VS Code Test Runner (official VS Code testing framework)
- **E2E tests**: VS Code Extension Tester (optional, for user journeys)

**Unit Test Coverage**:
- `src/core/state/` modules: Profile registry, state machine, activity tracker tests
- `src/core/policy/` modules: Policy engine, guard distributor, parser tests
- `src/core/adapters/contract.test.ts`: Adapter contract compliance tests (mock instances)
- `src/core/validation/` modules: Profile validator, capability checker, secret resolution tests
- `src/core/handoff/` modules: Summarizer, transcript oracle, serializer tests
- `src/core/audit/` modules: Audit writer, redaction engine tests
- `src/utils/` modules: Path normalizer, logger, crypto-utils tests

**Integration Test Coverage**:
- `tests/integration/vscode/extension.test.ts`: Extension activation, command registration
- `tests/integration/vscode/configuration.test.ts`: Configuration read/write, SecretStorage
- `tests/integration/ui/profile-selector.test.ts`: Profile selection UI, status bar updates
- `tests/integration/ui/handoff-dialog.test.ts`: Handoff dialog display and user interaction
- `tests/integration/ui/activity-ledger.test.ts`: Activity ledger visibility, conflict warnings
- `tests/integration/integration/claude-code-proxy.test.ts`: Claude Code CLI integration (mock CLI for testing)
- `tests/integration/integration/end-to-end.test.ts`: User journeys (profile selection, switching with handoff, privacy mode enforcement)

**Regression Test Pattern**:
- For each bug fix: Add test that reproduces the bug
- Verify test fails without fix, passes with fix
- Tag test with issue number and description

**Testing Commands**:
```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:integration": "vscode-test",
    "test:coverage": "vitest run --coverage"
  }
}
```

**References**:
- Vitest documentation
- VS Code Test Runner documentation
- Constitution Principle IV (Tested Behavior)

**Impact**: Test structure defined in Project Structure; unit tests in `tests/unit/`, integration tests in `tests/integration/`

---

## Summary of Research Outcomes

This research resolved all technical unknowns necessary for Phase 1 design. No "NEEDS CLARIFICATION" markers remain. All decisions align with constitution principles, spec requirements, and clarifications from interview session.

**Key Decisions Made**:
1. **Architecture**: Separation of pure logic (no VS Code API) and VS Code integration layers for testability
2. **Claude Code Integration**: CLI + config file manipulation as primary mode; API used only if documented
3. **Profile Schema**: YAML-based multi-layer with repository templates, user overlays, secret references, runtime overrides
4. **Privacy Policy**: Multi-mode enforcement (unrestricted/guarded/strict) with traffic classification
5. **Adapter Interface**: Abstract contract with capability declarations; 5 adapter types for v1
6. **Handoff**: Three-mode (full/summary/none) with local summarizer default, source-model opt-in
7. **Secrets**: All secrets in VS Code SecretStorage with reference-based resolution; redaction in logs
8. **Paths**: Use Node.js path, os.homedir(), VS Code.Uri; no hard-coded separators or home paths
9. **Activation**: Specific events (onCommand, workspaceContains); never `*` or `onStartupFinished`; <100ms overhead
10. **Testing**: Dual strategy (Vitest unit tests + VS Code Test Runner integration tests), regression tests required

**Next Phase**: Phase 1 will generate `data-model.md`, `contracts/`, and `quickstart.md` based on these research decisions.
