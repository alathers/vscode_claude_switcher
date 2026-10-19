# Feature Specification: VS Code Model Profile Orchestrator

**Feature Branch**: `(to be determined)`

**Created**: 2026-10-17

**Status**: Draft

**Input**: I have created a collection of md and yaml files to define a spec, requirements, etc. I would like to use these to create a VSCode plugin

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Select and activate a profile (Priority: P1)

Developers working in a shared repository need to select a workspace default profile and optionally override it per conversation, ensuring local, private-network, and cloud model providers can be used without restarting VS Code.

**Why this priority**: This is the core user experience - without profile selection and activation, no other functionality is usable. It enables the primary value proposition of dynamically switching among multiple AI coding-agent models during an open VS Code session.

**Independent Test**: A developer can open a trusted workspace, select from available profiles, see the resolved configuration (provider, model, trust zone), and have the profile immediately active for new sessions. Testing this alone demonstrates the extension's core value and can be validated without implementing switching, handoff, or advanced features.

**Acceptance Scenarios**:

1. **Given** a trusted workspace with a repository template and user profile overlay, **when** the developer selects a profile, **then** VS Code remains open and the UI shows the resolved provider, model, trust zone, and capability state.
2. **Given** a missing secret reference, **when** attempting to select a profile, **then** launch is blocked with a redacted and actionable diagnostic.
3. **Given** a repository profile template, **when** a developer attempts to add secret values through the template, **then** the schema prevents secret values and only allows non-secret endpoint/model/protocol details.

---

### User Story 2 - Switch profiles with handoff (Priority: P1)

Developers need to switch between different AI model profiles during an open VS Code session, optionally transferring conversation context between providers with explicit control over what gets transferred.

**Why this priority**: Profile switching is the core differentiator - enabling developers to use different models for different tasks while maintaining continuity. Without this capability, users would need to restart VS Code or manually recreate context, defeating the purpose of the extension.

**Independent Test**: A developer with an active conversation selects a different profile, sees handoff options (full transcript, reviewed summary, no context), makes a selection, and the context is transferred to the new profile. This demonstrates the product's core value proposition independently of profile management or concurrent agent features.

**Acceptance Scenarios**:

1. **Given** an active agent session, **when** the developer selects another profile, **then** the extension prompts to wait, cancel and switch, or retain the existing session in the background.
2. **Given** a source and destination profile with different trust zones, **when** a handoff is requested, **then** the developer sees all three handoff choices (full, summary, none) and the recommended choice for the trust-zone combination.
3. **Given** full transcript handoff is selected, **when** the handoff completes, **then** only the approved destination receives the transcript and the audit record contains metadata but not transcript text.
4. **Given** a native source with no supported transcript API, **when** a handoff is requested, **then** the UI states the limitation and presents supported user-mediated alternatives (user export/import, summary, or no-context).
5. **Given** default summary handoff, **when** a summary is generated, **then** code and sensitive data are excluded unless the developer explicitly approves inclusion.

---

### User Story 3 - Control privacy and routing policy (Priority: P1)

Teams need to enforce privacy boundaries for coding-agent sessions, particularly restricting direct disclosure of workspace data to cloud model providers while supporting necessary supporting network operations.

**Why this priority**: Privacy control is critical for enterprises and teams working with sensitive code. Without this capability, the extension would compromise one of its core value propositions - preventing unintended direct disclosure of workspace data to cloud model providers.

**Independent Test**: A workspace administrator sets a privacy mode (unrestricted, guarded, or strict), attempts a cloud model request, and observes the appropriate behavior (automatic approval, explicit approval required, or blocked). This validates the privacy engine independently of profile management or switching features.

**Acceptance Scenarios**:

1. **Given** strict mode is active, **when** a managed session attempts direct cloud-model routing, **then** the extension blocks the request before transmitting model input or handoff payload.
2. **Given** guarded mode is active, **when** a managed session targets a cloud model, **then** the extension requires explicit approval before dispatch.
3. **Given** guarded or strict mode, **when** supporting network operations (web research, source control, package/docs access) are attempted, **then** they remain allowed unless separate policy restricts them.
4. **Given** a privacy mode change, **when** the administrator modifies workspace policy, **then** the change may require confirmation, reason capture, timeout-based reversion, or second approval based on configuration.

---

### User Story 4 - Manage concurrent agents (Priority: P2)

Advanced users running multiple AI coding agents simultaneously need visibility into concurrent activity, warnings about potential conflicts, and optional safeguards to prevent overlapping modifications.

**Why this priority**: Concurrent agent use is valuable for productivity but introduces complexity. This feature prioritizes visibility and warnings over blocking behavior, ensuring users aren't surprised but can still make autonomous decisions.

**Independent Test**: A developer starts multiple sessions, sees an activity ledger displaying profile, state, and activity for each, receives warnings about overlapping file paths before mutations occur, and can enable optional safeguards (exclusive writer, worktree isolation, checkpoints). Validates the concurrence model independent of privacy or switching features.

**Acceptance Scenarios**:

1. **Given** two sessions indicating overlapping edits, **when** either begins a mutation, **then** the extension displays conflict warning and activity information.
2. **Given** exclusive-writer workspace policy, **when** another session attempts a mutation, **then** it is blocked or made read-only according to policy.
3. **Given** checkpoint-before-mutation is enabled, **when** an eligible agent modifies the workspace, **then** a configured checkpoint is created before the modification.
4. **Given** an activity ledger, **when** multiple agents are active, **then** it displays profile, state, known files, commands, and recent workspace changes for each.

---

### User Story 5 - Validate profiles and diagnostics (Priority: P2)

Developers need to validate profile configurations without incurring charges, identify conflicts, and get actionable error messages when configuration is incorrect or incomplete.

**Why this priority**: Configuration validation improves the user experience by preventing runtime errors and reducing trial-and-error. Default validation avoids costly mistakes without requiring billable model calls.

**Independent Test**: A developer creates or edits a profile, runs validation, and receives immediate feedback on schema compliance, policy compatibility, secret references, endpoint reachability, and declared capabilities. Validates the diagnostic system independently of runtime agent behavior.

**Acceptance Scenarios**:

1. **Given** a newly created profile, **when** default validation runs, **then** no inference request that could incur a model charge or send workspace content is made.
2. **Given** explicit authorization for deeper validation, **when** the developer approves it, **then** the UI identifies potential cost and destination before the request occurs.
3. **Given** conflicting inherited endpoint/authentication configuration, **when** validation runs, **then** diagnostics identify the conflict and redact all secret values.

---

### Edge Cases

- What happens when multiple profile validation errors exist simultaneously? → All errors are collected and presented together; validation continues until all issues are enumerated to avoid iterative fix cycles.
- How does the system handle SSH tunnel failure during profile activation? → Profile activation fails with a clear diagnostic; the user can retry or use an alternative profile; no partial state is left.
- What happens when a secret reference exists but the secret is not yet stored in SecretStorage? → Profile selection is blocked with a redacted error identifying the missing secret reference; the user can add the secret and retry.
- How does the system behave when a profile templates references a non-existent model ID? → Validation catches the model ID mismatch; warnings are displayed but the profile may still be usable if the endpoint supports model discovery.
- What occurs when the Claude Code CLI is unavailable or API returns unexpected results? → The extension degrades gracefully to configuration-guided new sessions or failed clearly with actionable diagnostics; no partial state is left.
- What occurs when concurrent agents both modify the same file simultaneously? → Warning is displayed but neither is blocked by default; optional policies can enable blocking, worktree isolation, or checkpoint-based rollback.
- What happens when the official Claude Code panel lacks transcript-access APIs? → The UI clearly states the limitation and offers user-mediated alternatives; full transcript handoff is not advertised as available for that integration mode.
- How does the system handle offline mode or network unavailability during profile validation? → Validation passes schema and policy checks; endpoint-reachability checks are skipped or marked as pending; profiles can be activated but may show a connectivity warning.
- How does the extension behave in fully air-gapped environments with no network access? → All local model profiles work normally; cloud profiles remain selectable but clearly indicator unavailable; all validation that would require network access is gracefully skipped; distribution must be installable without cloud dependencies.
- What happens when summary handoff is selected but no local summarizer is configured and source-model opt-in is disabled? → The system defaults to deterministic local outline summary; if outline generation fails, no-context handoff becomes the only available option with clear user communication.
- Can developers see which profiles teammates are using or their current activity? → No; observability is per-user only, scoped to each developer's local workspace; teams coordinate through explicit communication and shared policies rather than implicit cross-user visibility.

## Requirements *(mandatory)*

### Functional Requirements

#### Profile Management

- **FR-001**: System MUST support user-level profiles, repository-committed non-secret profile templates, workspace policy, and runtime session overrides
- **FR-002**: A workspace MUST have a default profile; each conversation/session MAY override it
- **FR-003**: A profile MUST support provider/protocol adapter, base URL, model ID, credential reference, SSH tunnel definition, context/output limits, tool permissions, privacy classification, network allowlist, environment-variable references, model instructions, path restrictions, health check, and capability declaration
- **FR-004**: Not-applicable fields MUST use typed semantics such as omitted, null, or enabled: false; empty strings MUST only be accepted where an adapter explicitly defines their meaning
- **FR-005**: Repository templates MUST NOT contain secret values, passwords, access tokens, private keys, or personal connection strings; they MAY contain endpoint/model/protocol details, SSH host aliases, privacy rules, and model-provider allowlists

#### Credentials

- **FR-010**: Native Claude subscription profiles MUST use the official Claude Code login already established on the developer's machine
- **FR-011**: The extension MUST NEVER read, store, relay, proxy, or log Claude subscription credentials
- **FR-012**: API-key and local-server secret values MUST use VS Code Secret Storage or a declared environment-variable reference
- **FR-013**: SSH profiles MUST use ~/.ssh/config, SSH-agent support, and OS-managed keys

**Clarification (Session 2026-10-17)**: The extension owns the full SSH tunnel lifecycle: it establishes SSH tunnels when profiles requiring tunnels are activated, monitors tunnel health with auto-reconnection on failure (with user notification), and closes tunnels cleanly on profile deactivation or extension shutdown. Tunnels are tracked in extension state and listed in the Activity Ledger.

- **FR-014**: Workspace configuration, including .vscode files, MUST NOT contain secrets

#### Endpoint Adapters

- **FR-020**: Version one MUST support native Claude Code subscription, Anthropic-compatible, OpenAI-compatible, Ollama, generic command, and reusable SSH-tunnel transport
- **FR-021**: Each adapter MUST declare streaming, tool use, file-edit, command-execution, model-discovery, and transcript-observability capabilities
- **FR-022**: Unsupported capabilities MUST be disabled or prominently warned about rather than assumed
- **FR-023**: Generic command profiles MUST run with a sanitized profile-specific environment

#### Session and UI Behavior

- **FR-030**: Users MUST be able to select a workspace default profile through a visible selector and override it per conversation
- **FR-031**: Switching profiles MUST NOT require restarting VS Code
- **FR-032**: The extension MUST attempt in-panel/native switching only where a documented or validated integration proves it safe
- **FR-033**: When direct official-panel control is unavailable, the extension MUST progressively offer: new panel session with handoff, configuration-guided new session, then terminal or webview fallback

**Clarification (Session 2026-10-17)**: When selecting a new profile while the native Claude Code panel is visible and running, the extension modifies Claude Code configuration files and presents a user notification with options to "(1) Restart Panel" (extension closes and reopens the panel) or "(2) Apply to Next Session" (configuration changed but active panel unaffected until user manually restarts).

- **FR-034**: The UI MUST disclose the integration mode and fallback currently in use
- **FR-035**: Profiles MUST display provider, resolved model, trust zone, and configurable cost, latency, availability, and identity-mismatch indicators

#### Privacy and Routing

- **FR-040**: The policy engine MUST distinguish model-provider traffic from supporting network traffic
- **FR-041**: Guarded mode MUST block direct cloud-model requests unless the user explicitly approves the request or destination
- **FR-042**: Strict mode MUST block direct cloud-model requests and cloud-bound handoffs until workspace policy changes
- **FR-043**: Supporting traffic, including web research, source control, package/documentation access, and other approved traffic, MUST remain allowed by default unless separately restricted
- **FR-044**: The extension MUST state that enforcement applies only to extension-managed requests and sessions
- **FR-045**: Policy changes MUST support configurable confirmation, reason capture, timed reversion, and optional second approval; confirmation is the default

#### Handoff and Transcripts

- **FR-050**: At a provider boundary, the extension MUST offer full transcript, reviewed summary, and no-context handoff choices
- **FR-051**: Default summaries MUST exclude code and sensitive data
- **FR-052**: Summary generation MUST use a locally-configured summarizer by default; source-model generation MUST be available as an opt-in alternative the user can enable; a deterministic local outline MUST be available as a fallback when neither summarizer is configured
- **FR-053**: Policy MUST configure whether summaries may include tool calls/results, paths, code snippets, diffs, command output, attachments, and sensitive-content redaction
- **FR-054**: The extension MUST retain local cross-profile handoff metadata according to configured retention settings
- **FR-055**: If native panel transcript access is unavailable, the UI MUST identify the limitation and offer user-mediated export/import or user-supplied summary options
- **FR-056**: Users MUST be able to delete a conversation or handoff packet, set retention, and manually export a sanitized handoff package

#### Concurrent Agents

- **FR-060**: Multiple agents MUST be allowed concurrently by default
- **FR-061**: The extension MUST display an activity ledger showing profile, state, intended paths/commands where known, and recent changes

**Clarification (Session 2026-10-17)**: For external native Claude Code panel sessions, the extension tracks sessions declaratively using a declared session acknowledgment pattern. When a profile is activated via extension (e.g., through status bar selector), the extension records session start time and profile ID. When the user switches profiles or manually closes the panel, the user must acknowledge the session end (or the extension detects via configuration changes). This approach avoids unreliable polling or heuristics and provides explicit user control over session tracking.

- **FR-062**: Potentially conflicting edits or commands MUST warn without blocking by default
- **FR-063**: Workspace policy MUST support exclusive-writer mode, profile-level command denial, review-only mode, optional worktree isolation, and automatic pre-edit checkpoints

#### Validation and Diagnostics

- **FR-070**: Adding or editing a profile MUST support automatic and on-demand validation
- **FR-071**: Default validation MUST avoid billable model calls and test configuration, secret-reference existence, endpoint reachability, SSH tunnel lifecycle, policy compatibility, and declared capabilities
- **FR-072**: Prompt, tool, or agent tests that may incur charges MUST require explicit authorization
- **FR-073**: Diagnostics MUST detect conflicting inherited endpoint/authentication configuration and redact all secret values

#### Delivery and Audit

- **FR-080**: Version one MUST support macOS and Linux
- **FR-081**: Installation, upgrade, diagnostics, team-template/policy setup, and uninstall documentation MUST be provided
- **FR-082**: Optional Python and Bash helpers MUST preview changes and require confirmation before modifying files
- **FR-083**: Local audit metadata MUST record profile selections, policy decisions, handoff mode, validation result, and session lifecycle, but MUST NOT record prompts, transcript content, source code, tokens, or raw secrets

### Key Entities

- **Profile**: Represents a complete configuration for an AI coding-agent endpoint, including provider type, connection details, credential references, capabilities, permissions, and privacy settings
- **Profile Template**: A repository-committed, non-secret configuration that defines reusable profile structure for team members; each overlay has user-specific secrets through references
- **Workspace Policy**: Defines privacy settings, concurrency rules, handoff defaults, and policy-change governance for a specific workspace; also configures practical limits including maximum profiles, concurrent sessions, and handoff metadata retention size
- **Credential Reference**: An identifier that resolves to an actual secret (API key, token, etc.) from VS Code SecretStorage, environment variables, or native Claude subscription
- **Session**: Represents an active conversation with an AI model, including the profile, state, activity ledger, and optional metadata; sessions may be managed (extension-controlled) or external (native Claude Code panel)
- **Handoff**: The act of transferring context between sessions or profiles, with options for full transcript, reviewed summary, or no-context transfer; audit metadata is retained without storing unauthorized content
- **Activity Ledger**: Real-time display of concurrent agent activity scoped to the individual developer's local workspace, showing profile, state, known files/commands, and recent changes for conflict detection; no cross-user visibility is provided
- **Privacy Classification**: A trust-zone label (local, private-network, cloud, etc.) that applies to profiles and informs policy-enforced routing decisions

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can select and activate a profile in under 10 seconds from opening the extension's profile selector
- **SC-002**: Profile switching and identity handoff between providers completes in under 5 seconds for summary and no-context modes
- **SC-003**: Privacy policy enforcement blocks 100% of unauthorized direct cloud-model requests in strict mode before any user data is transmitted
- **SC-004**: Default profile validation completes in under 3 seconds without making any billable API calls
- **SC-005**: At least 90% of workspace policy changes requiring confirmation are completed by developers on first attempt
- **SC-006**: Concurrent agent conflict warnings are displayed within 2 seconds of detecting overlapping file modification attempts
- **SC-007**: Extension activation and profile loading do not increase VS Code startup time by more than 100 milliseconds
- **SC-008**: Users can successfully switch between profiles in an open VS Code session without restarting the application 100% of the time
- **SC-009**: Secret credential storage and references prevent 100% of secrets from appearing in logs, error messages, or synced workspace files
- **SC-010**: Audit metadata accurately records profile selections and policy decisions without storing prohibited content (transcripts, prompts, code, tokens, secrets)
- **SC-011**: Local model profiles function completely offline without any cloud dependencies; cloud profiles show clear availability indicators when network is unreachable
- **SC-012**: Profile validation and extension activation complete successfully in air-gapped environments for local model configurations

## Clarifications

### Session 2026-10-17

- Q: What are the practical limits for the number of profiles, concurrent agent sessions, and maximum handoff metadata size that the extension should support for version one? → A: Configurable per-project limits
- Q: Which integration modes with the Claude Code panel are supported for retrieving transcripts, changing models, or starting new sessions? → A: Claude Code CLI + configuration file manipulation as primary modes
- Q: What specific security threats or attack vectors is the extension designed to defend against beyond unauthorized cloud egress? → A: Primary goal: multi-model use, secondary: air-gapped development defense
- Q: For handoff summary generation, should the extension use the source AI model to generate summaries or should it always use a locally-configured summarizer? → A: Use locally-configured summarizer as default, offer source-model as opt-in alternative
- Q: What level of observability should the system provide - should developers see which profiles are being used by teammates, or is all profile usage information scoped to each individual user's workspace? → A: Per-user only, scoped to local workspace; no cross-user profile usage visibility
- Q: How should the extension activate a profile when the native Claude Code panel is visible and already running a session? → A: Proactive profile update with user notification - extension modifies config and prompts user to restart panel or defer to next session
- Q: What should happen to SSH tunnels when a profile is deactivated or VS Code is closed? → A: Extension owns full lifecycle - extension establishes, monitors, auto-reconnects, and closes tunnels
- Q: How should the extension track native Claude Code panel sessions that are external and not directly managed by the extension? → A: Declared session acknowledgment pattern - extension tracks declaratively when profile activated, user acknowledges session end on profile switch or panel close

## Assumptions

- Target users operate in environments ranging from fully connected to air-gapped; the extension must support local models and offline validation without cloud dependencies
- Primary goal is enabling multiple models across different providers during development; secondary goal is supporting air-gapped/secure environments requiring local-only workflows
- Users have basic familiarity with VS Code extension installation and configuration through the Command Palette
- Users have SSH configured locally if they intend to use SSH-tunnel profile features
- Teams share repository templates through their code hosting platform (Git) and commit non-secret configuration
- Individual developers retain full control over their credentials and can securely store them through VS Code SecretStorage
- Claude Code integration uses CLI and configuration file manipulation as primary modes; any official VS Code extension APIs are used only if publicly documented and validated for third-party extension use
- Native Claude subscription credentials remain under Claude Code's control; the extension references existing authentication without intermediate storage
- macOS and Linux are the target platforms for version one; windows support is deferred but not excluded from future releases
- Extension will be distributed initially to a small trusted team (not public marketplace); distribution method (local VSIX, private registry) is to be determined
- Extension activation uses specific events (workspace contains relevant configuration files, profile-editing commands invoked) rather than universal `*` activation
- Additional runtime dependencies will be minimal; preferred approach uses Node.js and VS Code built-in capabilities where possible
- Maximum profiles, concurrent sessions, and handoff metadata retention size are configurable per project through workspace policy with sensible defaults
