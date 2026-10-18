# Data Model: VS Code Model Profile Orchestrator

**Date**: 2026-10-17
**Purpose**: Define entities, fields, types, relationships, validation rules, and state transitions

## Overview

This data model defines the core entities managed by the VS Code Model Profile Orchestrator extension. Entities are stored primarily in YAML files (profiles, templates, policies) and the extension's internal state (activity ledger, handoff metadata, audit logs). All secrets are stored in VS Code SecretStorage.

## Entity Definitions

### Profile

**Description**: Represents a complete configuration for an AI coding-agent endpoint, including provider type, connection details, credential references, capabilities, permissions, and privacy settings.

**Storage**:
- User profiles: `~/.claude-claude-switcher/profiles/<profileId>.yaml` (local, non-secret)
- Repository templates: `.claude-switcher/templates/<templateId>.tpl.yaml` (committed, non-secret)

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| schemaVersion | number | Yes | >= 1 | Schema version for evolution |
| id | string | Yes | Pattern: `^[a-z0-9-]+$` | Unique profile identifier |
| label | string | Yes | Non-empty | Human-readable profile name |
| adapter | enum | Yes | native-claude, anthropic-compatible, openai-compatible, ollama, generic-command | Provider/protocol type |
| model | string | Yes | Non-empty | Model identifier (e.g., "claude-3-5-sonnet-20241022", "qwen-coder") |
| baseUrl | string | No | Valid URL format | HTTP/HTTPS endpoint URL |
| credential | object | Yes | - | Credential configuration |
| credential.mode | enum | Yes | none, secretRef, environment, subscription | Credential resolution mode |
| credential.secretRef | string\|null | Conditional | Non-empty when mode=secretRef | VS Code SecretStorage reference |
| tunnel | object | Yes | - | SSH tunnel configuration |
| tunnel.enabled | boolean | No | - | Tunnel enabled flag |
| tunnel.sshHostAlias | string\|null | Conditional | Must exist in ~/.ssh/config when enabled=true | SSH config alias |
| tunnel.localPort | number\|null | Conditional | 1-65535 when enabled=true | Local tunnel port |
| limits | object | Yes | - | Usage limits |
| limits.contextTokens | number\|null | No | > 0 if provided | Context token limit |
| limits.maxOutputTokens | number\|null | No | > 0 if provided | Max output token limit |
| permissions | object | Yes | - | Model permissions |
| permissions.mode | enum | Yes | review-only, edit-only, edit-and-command | Permission mode |
| permissions.workspacePaths | string[] | No | - | Path restrictions (e.g., ["src/"]) |
| network | object | Yes | - | Network classification |
| network.providerClass | enum | Yes | local, private-network, cloud | Provider trust zone |
| network.supportingNetwork | enum | Yes | allowed, blocked | Supporting network traffic |
| instructions | string\|null | No | - | Model instructions |
| environmentRefs | string[] | No | - | Environment variable references |
| healthCheck | object | No | - | Endpoint health check |
| healthCheck.url | string | Conditional | Valid URL path if provided | Health check endpoint relative to baseUrl |
| healthCheck.method | enum | Conditional | GET, POST if provided | HTTP method |
| capabilities | object | Yes | - | Declared capabilities |
| capabilities.streaming | boolean | Yes | - | Streaming responses supported |
| capabilities.tools | boolean | Yes | - | Tool/function calling supported |
| capabilities.fileEdits | boolean | Yes | - | Direct file editing supported |
| capabilities.commands | boolean | Yes | - | Command execution supported |
| capabilities.modelDiscovery | boolean | Yes | - | Model list/retrieval supported |
| capabilities.transcriptObservable | boolean | Yes | - | Transcript retrieval supported |

**Relationships**:
- Optional **belongsToTemplate**: Profile Template (id match)
- Optional **usingSecretFrom**: VS Code SecretStorage record (credential.secretRef)

**Validation Rules**:
- FR-004: Not-applicable fields must use typed semantics (null, false, empty array) - not empty strings unless adapter explicitly defines them
- FR-005: Repository templates MUST NOT contain credential.secretRef values (only overlays)
- FR-021: Capabilities must be declared truthfully; adapter validation checks against declared capabilities

**State Transitions**:
- Draft → Validated: After validation passes (schema, policy, secrets, endpoint)
- Validated → Active: After successful activation attempt
- Active → Inactive: User deactivates or switches profiles
- Inactive → Active: User reactivates or switches back

---

### Profile Template

**Description**: A repository-committed, non-secret configuration that defines reusable profile structure for team members; each user overlay has user-specific secrets through references.

**Storage**: `.claude-switcher/templates/<templateId>.tpl.yaml` (committed, non-secret)

**Fields**: Same as Profile entity, with restrictions:
- `credential.secretRef` MUST be null or omitted (FR-005)
- `tunnel.sshHostAlias` may be present (non-secret alias reference)
- `environmentRefs` may be present (non-secret variable names)

**Validation Rules**:
- FR-005: Repository templates MUST NOT contain secret values, passwords, access tokens, private keys, or personal connection strings
- Template structure identical to profile schema for easy overlaying
- Templates may define endpoint/model/protocol details, SSH host aliases, privacy rules, and allowlists

**Relationships**:
- 0..N **usedBy**: User profiles that overlay this template

---

### Workspace Policy

**Description**: Defines privacy settings, concurrency rules, handoff defaults, and policy-change governance for a specific workspace.

**Storage**: `.claude-switcher/policy.yaml` (workspace-scoped)

**Fields**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| schemaVersion | number | Yes | >= 1 | Schema version |
| privacy | object | Yes | - | Privacy configuration |
| privacy.mode | enum | Yes | unrestricted, guarded, strict | Privacy enforcement mode |
| privacy.cloudModelRequests | object | Yes | - | Cloud model request policy |
| privacy.cloudModelRequests.default | enum | Yes | require-confirmation, block, allow | Default action |
| privacy.handoff | object | Yes | - | Handoff configuration |
| privacy.handoff.allowedModes | enum[] | Yes | Subset of [full, summary, none] | Allowed handoff modes |
| privacy.handoff.defaultMode | enum | Yes | One of allowedModes | Default handoff mode |
| privacy.handoff.summaryDefault | object | Yes | - | Default summary fields |
| privacy.handoff.summaryDefault.includeCode | boolean | Yes | - | Include code snippets in summary |
| privacy.handoff.summaryDefault.includeSensitiveData | boolean | Yes | - | Include sensitive data in summary |
| privacy.handoff.summaryDefault.includeToolOutput | boolean | Yes | - | Include tool call results |
| privacy.handoff.summaryDefault.includeDiffs | boolean | Yes | - | Include code diffs |
| privacy.handoff.summaryDefault.includeCommandOutput | boolean | Yes | - | Include command execution output |
| privacy.handoff.summaryDefault.includePaths | boolean | Yes | - | Include file paths |
| privacy.policyChanges | object | Yes | - | Policy change governance |
| privacy.policyChanges.requireConfirmation | boolean | Yes | - | Require confirmation before change |
| privacy.policyChanges.requireReason | boolean | Yes | - | Require reason input |
| privacy.policyChanges.revertAfterMinutes | number\|null | No | > 0 if provided | Auto-revert timeout |
| privacy.policyChanges.requireSecondApprover | boolean | Yes | - | require second approval |
| concurrency | object | Yes | - | Concurrency configuration |
| concurrency.default | enum | Yes | concurrent, exclusive-writer | Default concurrency mode |
| concurrency.conflictAction | enum | Yes | warn, block | Action on conflicts |
| concurrency.supportsWorktrees | boolean | Yes | - | Worktree isolation available |
| concurrency.checkpointBeforeMutation | boolean | Yes | - | Automatic checkpoint before edits |
| profiles | object | Yes | - | Profile governance |
| profiles.allowedTemplateIds | string[] | Yes | - | Allowed profile template IDs |

**Validation Rules**:
- `privacy.handoff.defaultMode` must be in `privacy.handoff.allowedModes`
- `profiles.allowedTemplateIds` must reference existing templates in `.claude-switcher/templates/`
- FR-040: Policy engine must distinguish model-provider traffic from supporting network traffic
- FR-041-FR-042: Guarded and strict modes apply blocking rules

**State Transitions**:
- draft → active: Policy loaded and validated
- active → modified: Policy changes (may require confirmation, reason, timeout, approver)

---

### Credential Reference

**Description**: An identifier that resolves to an actual secret (API key, token, etc.) from VS Code SecretStorage, environment variables, or native Claude subscription.

**Storage**: In profile YAML (`credential.secretRef` field) and resolved at runtime from SecretStorage

**Fields**:

| Field | Type | Description |
|-------|------|-------------|
| referenceId | string | Unique identifier (e.g., "api-key:openai-model-a", "secret:local-server-1") |
| storageType | enum | secrets (VS Code SecretStorage), environment, subscription (native Claude) |
| createdAt | timestamp | When credential was stored |
| lastAccessed | timestamp | Last access for audit |
| valueType | string | Human-readable type (e.g., "API Key", "Bearer Token", "SSH Key passphrase") |

**Validation Rules**:
- FR-012: API-key and local-server secret values MUST use VS Code SecretStorage or declared environment-variable reference
- FR-013: SSH profiles use ~/.ssh/config and SSH-agent; no secrets stored
- FR-014: Workspace configuration (.vscode files) MUST NOT contain secrets

**Relationships**:
- 1..N **usedBy**: Profiles referencing this credential

---

### Session

**Description**: Represents an active conversation with an AI model, including the profile, state, activity ledger, and optional metadata; sessions may be managed (extension-controlled) or external (native Claude Code panel).

**Storage**: In-memory with optional metadata persistence to `~/.claude-claude-switcher/sessions/` (no prohibited content)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | Yes | Unique session identifier (UUID) |
| profileId | string | Yes | Active profile for this session |
| sessionType | enum | Yes | managed, external (native Claude Code panel) |
| state | enum | Yes | initializing, active, idle, switching, terminated |
| startTime | timestamp | Yes | Session start time |
| lastActivity | timestamp | Yes | Last user/agent activity |
| activeFiles | string[] | No | Files known to be modified in this session |
| activeCommands | string[] | No | Commands likely to be executed |
| conflictRisk | enum | No | low, medium, high (based on overlapping activity) |
| handoffMetadata | object\|null | No | Only metadata, no content (last handoff info) |

**Validation Rules**:
- FR-060: Multiple agents allowed concurrently by default
- FR-061: Activity ledger shows profile, state, known files/commands, recent changes
- FR-062: Potentially conflicting edits or commands warn without blocking by default

**Relationships**:
- 1 **uses**: Profile
- 0..N **participatesInConflicts**: Overlapping modifications with other sessions

**State Transitions**:
- initializing → active: Session initialized and profile loaded
- active → idle: Period of no activity (timeout configurable)
- idle → active: New activity in idle session
- active → switching: User initiates profile change
- switching → active: Handoff completed, new profile active
- active/switching/idle → terminated: User closes session or error

---

### Handoff

**Description**: The act of transferring context between sessions or profiles, with options for full transcript, reviewed summary, or no-context transfer; audit metadata is retained without storing unauthorized content.

**Storage**: `~/.claude-claude-switcher/handoffs/[timestamp].json` (metadata only, no transcript/summary content)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| handoffId | string | Yes | Unique handoff identifier (UUID) |
| sourceSessionId | string | Yes | Source session transferring from |
| sourceProfileId | string | Yes | Source profile |
| destinationSessionId | string\|null | No | Destination session (if new session created) |
| destinationProfileId | string | Yes | Destination profile |
| mode | enum | Yes | full, summary, none |
| timestamp | timestamp | Yes | When handoff occurred |
| summaryFields | object\|null | Conditional | Fields included in summary (when mode=summary) |
| summaryFields.includedCode | boolean | Yes | Code snippets included |
| summaryFields.includedSensitiveData | boolean | Yes | Sensitive data included |
| summaryFields.includedToolOutput | boolean | Yes | Tool output included |
| summaryFields.includedDiffs | boolean | Yes | Diffs included |
| summaryFields.includedCommandOutput | boolean | Yes | Command output included |
| summaryFields.includedPaths | boolean | Yes | Paths included |
| transcriptHash | string\|null | Conditional | Hash of full transcript (when mode=full) |
| contentSize | number | No | Approximate byte size of content (not stored) |
| retentionExpiry | timestamp\|null | No | When audit metadata expires |
| userApproval | boolean | Yes | User explicitly approved this handoff |

**Validation Rules**:
- FR-050: At provider boundary, offer full transcript, reviewed summary, and no-context choices
- FR-051: Default summaries exclude code and sensitive data (unless user approves)
- FR-054: Retain local cross-profile handoff metadata according to configured retention
- Constitution: Must not store transcript content, prompts, or secrets in handoff metadata

**Relationships**:
- 1 **fromSession**: Session transferring from
- 1 **toProfile**: Profile transferring to

**State Transitions**:
- initiating → pending: User selects destination profile and mode
- pending → in-progress: Handoff content generation (summary retrieval/validation)
- in-progress → completed: Handoff successful, destination profile active
- in-progress → failed: Handoff failed (error, cancellation, validation failure)

---

### Activity Ledger Entry

**Description**: Real-time display of concurrent agent activity, showing profile, state, known files/commands, and recent changes for conflict detection.

**Storage**: In-memory, per-user only (no cross-user visibility per clarification)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | Yes | Session identifier |
| profileId | string | Yes | Active profile |
| label | string | Yes | Profile label (for display) |
| state | enum | Yes | initializing, active, idle, switching, terminated |
| knownFiles | string[] | No | Files modified or about to be modified |
| knownCommands | string[] | No | Commands likely to be executed |
| recentChanges | Change[] | No | Recent workspace modifications |
| conflictRisk | enum | No | low, medium, high (based on overlaps) |
| lastUpdated | timestamp | Yes | Last activity timestamp |
| providerClass | enum | Yes | local, private-network, cloud |

Change sub-entity:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| filePath | string | Yes | Absolute file path |
| changeType | enum | Yes | create, modify, delete |
| timestamp | timestamp | Yes | When change occurred |

**Validation Rules**:
- FR-061: Activity ledger shows profile, state, known files/commands, recent changes
- Clarification: Observable is per-user only, no cross-user visibility

**Relationships**:
- 1 **forSession**: Session

---

### Privacy Classification

**Description**: A trust-zone label (local, private-network, cloud, etc.) that applies to profiles and informs policy-enforced routing decisions.

**Storage**: In profile and handoff metadata; not persisted separately

**Fields**:

| Field | Type | Allowed Values | Description |
|-------|------|----------------|-------------|
| classification | enum | local, private-network, cloud | Provider trust zone |

**Validation Rules**:
- FR-042: Strict mode blocks direct cloud-model requests and cloud-bound handoffs until policy changes
- FR-043: Supporting traffic remains allowed by default unless separately restricted

**Relationships**:
- 1 **appliesTo**: Profile, Handoff source/destination

**Classification Logic**:
- **local**: Models running on localhost (Ollama, generic command)
- **private-network**: Models accessible via SSH tunnel or corporate network (VPN, VPC)
- **cloud**: Models hosted by public providers (Anthropic, OpenAI, etc.)

---

### Audit Log Entry

**Description**: Audit metadata recording profile selections, policy decisions, handoff mode, validation result, session lifecycle events. Never records prompts, transcript content, source code, tokens, or raw secrets (per FR-083 and constitution).

**Storage**: `~/.claude-claude-switcher/audit.log` (append-only, line-delimited JSON)

**Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| timestamp | timestamp | Yes | When event occurred |
| eventType | enum | Yes | profile-selected, policy-changed, handoff-initiated, handoff-completed, handoff-failed, validation-run, session-started, session-ended, conflict-warning |
| profileId | string\|null | No | Related profile ID |
| sessionId | string\|null | No | Related session ID |
| userId | string | No | User identifier (hash of workspace path) |
| action | string | No | High-level action description |
| metadata | object | Yes | Event-specific metadata |
| metadata.policyMode | enum\|null | No | reserved, guarded, strict (for policy-changed) |
| metadata.handoffMode | enum\|null | No | full, summary, none (for handoff events) |
| metadata.validationResult | enum\|null | No | passed, failed, partial (for validation events) |
| metadata.conflictType | enum\|null | No | file-overlap, command-conflict (for conflict-warning) |
| metadata.reason | string\|null | No | User-provided reason for policy change |

**Validation Rules**:
- FR-083: Audit metadata MUST NOT record prompts, transcript content, source code, tokens, or raw secrets
- Cursor: Only low overhead metadata (profileId, timestamp, eventType, action) is stored

**Prohibited Content** (must never be stored):
- Prompts or queries sent to models
- Transcript or summary content (only mode and field inclusion flags)
- Source code content (only file paths and change counts)
- API tokens or secrets (only secret reference IDs, hashed)
- Token usage or cost details (only relative budget or limit if configured)

---

## Entity Relationship Diagram (Simplified)

```
Profile ───┐
  │        ├───► Credential Reference (via credential.secretRef)
  │        │        (stored in SecretStorage)
  │        │
  ├───► Profile Template (via belongsToTemplate)
  │        (repository-committed)
  │
  └───► Session (uses profile)
           │
           ├───► Handoff (fromSession)
           │        └───► Profile (toProfile)
           │
           └───► Activity Ledger Entry (forSession)

Workspace Policy ──► Profile Template (via allowedTemplateIds)
                    (governance)

Handoff ──► Privacy Classification (applies to source/destination profiles)
          (trust zone)
```

---

## Validation and Constraints Summary

### Cross-Entity Constraints

1. **Secret Reference Validity**: Any credential.secretRef must exist in VS Code SecretStorage before profile activation
2. **Template Permission**: Profiles can only use templates listed in Workspace Policy's allowedTemplateIds
3. **Handoff Mode**: Handoff mode must be in allowedModes defined in Workspace Policy
4. **Profile Limits**: Concurrent sessions and profiles cannot exceed workspace-configured limits
5. **Transcript Availability**: Full transcript handoff only available if source profile's capabilities.transcriptObservable is true

### State Machine Constraints

1. **Handoff Integrity Cannot proceed if source or destination profile fails validation
2. **Session Isolation**: External sessions (native Claude Code panel) may not be fully observable
3. **Policy Adherence Profile activation must respect Workspace Policy (allowed templates, privacy mode)
4. **Conflict Detection** Multiple sessions modifying same file trigger conflict warning

### Data Integrity Constraints

1. **Atomic Operations**: File writes use write-to-temp-then-rename (FR from constitution)
2. **Read-Only Settings**: User vs. workspace scoping respected (FR Constitution)
3. **Secret Isolation**: Secrets never in workspace files or logs (FR-014, FR-083)
4. **Platform Agnostic Paths**: All paths use Node.js path, os.homedir, VS Code.Uri

---

## Next Steps

This data model informs:
- **Profile Schema Contract** (`contracts/profile-schema.md`)
- **Adapter Interface Contract** (`contracts/adapter-interface.md`)
- **UI Contracts** (`contracts/ui-contracts.md`)
- **Quickstart Validation Guide** (`quickstart.md`)

Implementation in Phase 2 (tasks.md) will map these entities to TypeScript interfaces, zod schemas for validation, and file storage adapters.
