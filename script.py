from pathlib import Path
out = Path('output/speckit-vscode-model-profiles')
out.mkdir(parents=True, exist_ok=True)
files = {
'spec.md': '''# VS Code Model Profile Orchestrator

## Purpose
Build a VS Code extension for a small trusted team that dynamically selects and coordinates AI coding-agent model profiles while VS Code remains open. The primary experience is the official Claude Code VS Code panel; integrated-terminal and extension-managed/webview sessions are secondary fallbacks. A profile may use a native Claude Code subscription, a local model, an SSH-tunneled model, a remote HTTPS endpoint, or a configured command adapter.

The product must make switching feel as close as possible to changing models in one conversation while preserving explicit privacy boundaries, reliable endpoint isolation, and user control over context transfer.

## Users
- Developers working in a shared repository with a mix of local, private-network, and cloud model providers.
- A small trusted team sharing non-secret templates and workspace policy, while every developer retains their own credentials.

## Product principles
1. Native-first: preserve the official Claude Code panel as the primary experience whenever supported.
2. No credential interception: never read, store, proxy, or expose Claude subscription credentials.
3. Local control: profiles, privacy policy, and handoff content are visible and explainable.
4. Least disclosure: default handoff summaries omit code and sensitive data.
5. Provider isolation: each managed session has profile-specific routing and credential resolution.
6. Concurrent by default: multiple agents may work simultaneously, with transparent activity and conflict safeguards.
7. Policy is enforceable only at managed boundaries: clearly state that the extension cannot govern unrelated processes or extensions.

## In scope
- Dynamic profile selection without restarting VS Code.
- Workspace default profile plus per-conversation override.
- User profiles, repository-shared non-secret templates, workspace policy, and temporary runtime overrides.
- Native Claude Code subscription, Anthropic-compatible, OpenAI-compatible, Ollama, generic command, remote HTTPS, and SSH-tunneled profiles.
- Profile capability checks that avoid billable model calls by default.
- Guarded and strict model-provider egress policies.
- Universal handoff choices: full transcript, reviewed summary, and no context.
- Native-first UI with progressive fallback when direct official-panel control is not supported.
- Concurrent-agent activity ledger, warnings, optional exclusive-writer rules, optional worktree isolation, and automatic checkpoints.
- macOS and Linux installation, validation, and removal documentation/tools.

## Out of scope for initial implementation
- A custom replacement coding-agent chat UI.
- Reading, altering, or proxying private credentials owned by Claude Code or another provider client.
- A shared secrets service or mandatory cloud control plane.
- A custom third-party provider SDK; retain schema extensibility only.
- A guarantee that all arbitrary OpenAI-compatible or Anthropic-compatible services support coding-agent tools.

## Success statement
The first release is successful when a small team can select and switch among approved local, private, and cloud coding-agent profiles during an open VS Code session, continue work through an explicit handoff workflow, and prevent unintended direct disclosure of workspace data to cloud model providers.
''',
'requirements.md': '''# Requirements

## Functional requirements

### Profile management
- FR-001: The extension shall support user-level profiles, repository-committed non-secret profile templates, workspace policy, and runtime session overrides.
- FR-002: A workspace shall have a default profile; each conversation/session may override it.
- FR-003: A profile schema shall include provider/protocol adapter, base URL, model ID, credential reference, SSH tunnel definition, context/output limits, tool permissions, privacy classification, provider allowlist, environment-variable references, model instructions, path restrictions, health check, and capability declaration.
- FR-004: Fields not applicable to an adapter shall be explicitly represented with typed null/disabled semantics. Empty strings are accepted only where the adapter explicitly defines them.
- FR-005: Repository templates may contain endpoint/model/protocol details, SSH host aliases, privacy rules, and network policy, but never secret values, passwords, access tokens, private keys, or full personal connection strings.

### Credentials
- FR-010: Native Claude subscription profiles shall use the official Claude Code login already present on the developer device.
- FR-011: The extension shall never read, store, relay, or log Claude subscription credentials.
- FR-012: API and local-server secret values shall be stored through VS Code Secret Storage or resolved from a declared environment-variable reference.
- FR-013: SSH profiles shall use existing SSH config aliases, SSH agent support, and OS-managed keys.
- FR-014: Workspace files, including .vscode files, shall never contain secrets.

### Endpoint adapters
- FR-020: Support native Claude Code subscription, Anthropic-compatible, OpenAI-compatible, Ollama, generic command, and SSH tunnel transport in the MVP.
- FR-021: Each adapter shall declare its supported capabilities, including streaming, tools, file editing, command execution, model discovery, and transcript observability.
- FR-022: Unsupported capabilities shall be disabled or warned about rather than assumed.
- FR-023: The generic command adapter shall receive a sanitized, profile-specific environment only.

### Session selection and fallback
- FR-030: Users shall select a workspace default profile from a status/UI selector and override it per conversation.
- FR-031: Switching shall not require restarting VS Code.
- FR-032: The extension shall attempt in-panel/native switching only where a supported integration proves it safe.
- FR-033: If direct official-panel session control is unavailable, progressively offer: new panel session with handoff, supported configuration plus user-started conversation, then managed terminal or extension webview fallback.
- FR-034: The UI shall disclose the active integration capability and fallback being used.

### Privacy and routing policy
- FR-040: Policies shall distinguish model-provider traffic from other supporting network traffic.
- FR-041: Guarded mode shall block direct cloud-model requests unless the user explicitly approves the request/destination.
- FR-042: Strict mode shall block direct cloud-model requests and cloud-bound handoffs until policy is changed.
- FR-043: Supporting traffic such as web research, source control, package/documentation access, and approved services shall remain allowed by default unless separately restricted.
- FR-044: Enforcement shall apply only to extension-managed requests/sessions; documentation and UI shall state this scope.
- FR-045: Policy changes shall support configurable confirmation, reason capture, timed reversion, and optional second approver. Default: confirmation required.

### Handoff and transcript
- FR-050: The product shall offer full transcript, reviewed summary, and no-context handoff choices at a provider boundary.
- FR-051: Default summaries shall exclude code and detected sensitive content.
- FR-052: Summary generation shall be selectable between source-model generation and a locally configured summarizer; deterministic locally generated outlines shall be supported as a fallback.
- FR-053: Policy shall configure whether summaries may include tool calls/results, paths, code snippets, diffs, command output, attachments, and sensitive-content redaction.
- FR-054: The extension shall preserve a local cross-profile handoff record according to retention settings.
- FR-055: When native panel transcript access is unavailable, the UI shall state the limitation and provide supported export/import or user-supplied summary routes.
- FR-056: Users shall be able to delete individual conversations/handoff packets, set retention, and manually export sanitized handoff packages.

### Concurrent agents
- FR-060: Multiple agents shall be permitted concurrently by default.
- FR-061: The extension shall show an activity ledger with profile, state, intended paths/commands when known, and recent changes.
- FR-062: Potentially conflicting edits/commands shall warn but not block by default.
- FR-063: Policy shall support exclusive-writer mode, selected-profile command denial, review-only profiles, worktree isolation, and automatic pre-edit checkpoints.

### Validation and diagnostics
- FR-070: Adding/editing a profile shall support automatic and on-demand validation.
- FR-071: Default validation shall avoid billable model calls and test configuration, secret resolution, endpoint reachability, SSH tunnel lifecycle, policy compatibility, and declared capabilities.
- FR-072: Optional billable prompt/tool tests require explicit user authorization.
- FR-073: Diagnostics shall identify conflicting inherited endpoint/authentication configuration and never disclose secret values.

### Delivery and audit
- FR-080: Support macOS and Linux in v1.
- FR-081: Provide detailed install, upgrade, diagnostics, policy/template installation, and uninstall documentation.
- FR-082: Provide optional Python and Bash helpers that preview changes and require confirmation before modifying files.
- FR-083: Local audit metadata shall record profile selection, policy decisions, handoff choice, validation outcome, and session lifecycle without prompts, transcripts, source code, tokens, or secrets.

## Non-functional requirements
- NFR-001: Secret values must not appear in logs, telemetry, exceptions, exported diagnostics, configuration, or audit metadata.
- NFR-002: The active profile must be visibly identified by provider/model/trust zone and may display configured cost, latency, availability, and resolved-identity mismatch status.
- NFR-003: Configuration must be understandable, inspectable, and versionable without committing credentials.
- NFR-004: The extension must behave safely in VS Code Restricted Mode; execution-capable features require workspace trust.
''',
'workflows.md': '''# Workflows

## Select a profile
1. Developer opens a trusted workspace.
2. Extension loads repository policy/templates, local user profiles, secret references, and runtime overrides.
3. Developer chooses a workspace default profile or a per-conversation override.
4. Extension runs non-billable preflight validation and displays provider, model, trust zone, capability state, and configuration conflicts.
5. The selected profile becomes active for new eligible sessions without restarting VS Code.

## Switch a conversation
1. Developer chooses another profile while a session exists.
2. Extension checks current operation state and prompts: wait, cancel and switch, or retain old session in background.
3. Extension evaluates source/destination trust zones and workspace policy.
4. Developer chooses full transcript, reviewed summary, or no context.
5. For a summary, default output excludes code and sensitive content; user reviews permitted sections.
6. Extension creates or activates the best available destination session: direct native switch if supported, new native panel session, configuration-guided new session, managed terminal, or webview fallback.
7. Extension records only metadata about the handoff and shows the actual destination/session capability.

## Guarded/strict policy
1. Workspace begins in unrestricted, guarded, or strict policy mode.
2. Before an extension-managed request goes to a cloud model, policy checks destination/provider classification and handoff payload.
3. Guarded mode requires explicit approval; strict mode blocks the request until policy changes.
4. Supporting network traffic remains allowed unless separately restricted.
5. Changing policy offers configurable confirmation, reason capture, timed reversion, and optional second approval; default is confirmation.

## Concurrent agents
1. Developer starts multiple profile sessions.
2. Activity ledger displays agent state and known intended mutations.
3. Before edits or commands, the extension warns about overlapping paths/recent changes.
4. Workspace policy can allow the action, require exclusive writer, force review-only, use a worktree, or create a checkpoint.
5. Conflicts remain visible for human resolution; no automatic merge safety is implied.

## Profile validation
1. Developer adds or edits a profile.
2. Validation checks schema, policy, secret reference existence, endpoint/tunnel reachability, and declared capability compatibility without sending a billable prompt by default.
3. Optional deeper tests require affirmative approval and disclose possible charges or data transfer.
4. Diagnostic output redacts secrets and identifies precedence/routing conflicts.
''',
'data-model.md': '''# Data Model

## Profile layers

```text
Repository policy/template (committed, non-secret)
  -> User profile overlay (local, non-secret)
    -> Secret references (local storage, env, SSH agent)
      -> Runtime override (temporary, local)
```

## Illustrative profile schema

```yaml
schemaVersion: 1
id: laptop-ollama-qwen
label: Laptop Ollama - Qwen Coder
adapter: ollama # native-claude | anthropic-compatible | openai-compatible | ollama | command
model: qwen-coder
baseUrl: http://127.0.0.1:11434
trustZone: local # local | private-network | cloud
credential:
  mode: none # none | secretRef | environment | subscription
  secretRef: null
tunnel:
  enabled: false
  sshHostAlias: null
  localPort: null
limits:
  contextTokens: null
  maxOutputTokens: null
permissions:
  mode: edit-and-command # review-only | edit-only | edit-and-command
  workspacePaths: []
network:
  providerClass: local
  supportingNetwork: allowed
instructions: null
environmentRefs: []
healthCheck:
  url: /api/tags
  method: GET
capabilities:
  declared:
    streaming: true
    tools: true
    fileEdits: true
    commands: true
    transcriptObservable: false
```

## Workspace policy

```yaml
schemaVersion: 1
privacy:
  mode: guarded # unrestricted | guarded | strict
  cloudModelRequests:
    default: require-confirmation
  handoff:
    allowedModes: [full, summary, none]
    defaultMode: summary
    summaryDefault:
      includeCode: false
      includeSensitiveData: false
      includeToolOutput: false
      includeDiffs: false
      includeCommandOutput: false
      includePaths: true
  policyChanges:
    requireConfirmation: true
    requireReason: false
    revertAfterMinutes: null
    requireSecondApprover: false
concurrency:
  default: concurrent
  conflictAction: warn
  supportsWorktrees: true
  checkpointBeforeMutation: false
profiles:
  allowedTemplateIds: []
```

## Handoff record

```yaml
id: handoff-uuid
createdAt: ISO-8601
sourceSessionId: local-id
sourceProfileId: profile-id
destinationProfileId: profile-id
mode: full # full | summary | none
policyDecision: allowed-with-confirmation
contentManifest:
  transcript: true
  code: false
  toolOutput: false
  paths: true
  diffs: false
  attachments: false
  sensitiveRedactionApplied: true
retentionUntil: ISO-8601-or-null
```

Audit records contain metadata only and never content payloads or secret values.
''',
'technical-context.md': '''# Technical Context

## Platform
- VS Code extension, macOS and Linux first.
- Primary integration target: official Claude Code VS Code panel.
- Secondary routes: integrated terminal, profile-managed CLI sessions, and extension webview fallback.
- Optional companion Python and Bash utilities for installation, diagnostics, template/policy setup, and uninstall.

## Integration constraints
- Treat third-party direct control/read access to the Claude Code panel as unverified until a documented/public integration surface is validated.
- Preserve native Claude Code subscription authentication; never access its stored credentials.
- Isolate routing/configuration per profile/session. Do not repeatedly rewrite shared global settings as a switching mechanism.
- Use VS Code Secret Storage for extension-owned API secrets; use symbolic references in configuration.
- Use SSH config aliases and agent-managed credentials rather than private key material in profiles.
- Respect VS Code Workspace Trust; avoid execution-capable behavior in restricted workspaces.

## Adapter approach
- Define a common adapter contract: validate, resolve launch/session strategy, discover/validate model, declare capabilities, construct sanitized environment, and describe transcript observability.
- Ship native Claude, Anthropic-compatible, OpenAI-compatible, Ollama, command, and reusable SSH-tunnel support.
- Treat capability claims as testable declarations. Do not infer coding-agent tool support from basic HTTP compatibility.

## Validation approach
- Non-billable checks by default: local schema, policy, secret-reference existence, DNS/TCP/HTTP health where safe, SSH tunnel readiness, model endpoint metadata where available, and configuration conflict detection.
- Billable/model-input checks are opt-in and visibly explain possible data egress/cost.
- Redact secrets from diagnostics and support copy-safe diagnostic bundles.

## Security notes
- Extension-level policy controls only traffic and processes it manages.
- Supporting network access is allowed by default; cloud-model egress is governed separately.
- Repository policy/templates remain non-secret and code-reviewable.
- Transcript visibility depends on adapter support. Native-panel full transcript handoff requires a validated lawful integration route or user-mediated export/import.
''',
'acceptance-criteria.md': '''# Acceptance Criteria

## Profile selection
- Given a trusted workspace with an allowed template and a user overlay, when a developer selects it, then VS Code remains open and the extension displays the resolved provider, model, trust zone, and capability state.
- Given a missing secret reference, when the profile is selected, then launch is blocked with a redacted, actionable diagnostic.
- Given a repository template, then no secret value can be committed through the template schema or installer-generated files.

## Privacy
- Given strict mode, when a managed session attempts direct cloud-model routing, then the extension blocks it without transmitting the handoff/model payload.
- Given guarded mode, when a managed session targets a cloud model, then the extension requires explicit confirmation before request dispatch.
- Given either guarded or strict mode, when an allowed supporting-network operation occurs, then it is not blocked solely because it is network traffic.
- Given a summary handoff under default policy, then code and sensitive data are excluded unless the user changes permitted fields through the reviewed workflow.

## Handoff
- Given an available source transcript, when the user chooses full handoff, then only the approved destination receives the transcript and the local handoff metadata records the choice without recording transcript text.
- Given a native source with no supported transcript API, when handoff is requested, then the UI states the limitation and offers supported user-mediated alternatives.
- Given no-context handoff, when a destination starts, then no transcript or summary payload is sent.

## Concurrency
- Given two sessions that indicate overlapping file edits, when either attempts a mutation, then the extension displays a conflict warning and activity information.
- Given a workspace set to exclusive writer, when another session tries a write/command mutation, then it is prevented or made read-only according to policy.
- Given checkpoint-before-mutation enabled, when an eligible agent begins editing, then the configured checkpoint is created before mutation.

## Validation
- Given a new profile, when default validation runs, then it performs no prompt that could incur model charges or send workspace content.
- Given a user explicitly authorizes deep validation, when the adapter supports it, then the UI identifies the request as potentially billable and shows the destination.

## Install and removal
- Given macOS or Linux, when a user runs a helper, then it previews all changes and requires confirmation before writing files.
- Given uninstall, when it completes, then it removes only extension-managed artifacts selected by the user and does not delete unrelated credentials, SSH configuration, or global Claude Code settings.
''',
'open-questions.md': '''# Open Questions and Spikes

## Must validate before committing architecture
1. What documented/public VS Code extension API, if any, permits controlling the active official Claude Code panel session, selecting its profile/routing, or accessing transcript content?
2. Which profile settings can be applied per panel session versus globally, and what requires a newly opened session?
3. Can the official panel support non-Anthropic-compatible/OpenAI-compatible backends directly, or must those use terminal/webview/custom adapter routes?
4. What lawful, user-mediated export/import mechanism can support full handoff if programmatic transcript access is unavailable?
5. Which model servers offer sufficiently compatible tool/file/command behavior for the desired adapters?

## Product decisions still open
1. License and distribution: private extension, open source with private configuration, or Marketplace distribution.
2. Retention defaults and encryption model for local transcript/handoff storage.
3. Whether team-visible audit export is required beyond local troubleshooting metadata.
4. Whether second approval for policy changes is needed and how a small team authenticates approvers.
5. Whether Windows, WSL, dev containers, Remote SSH, and Codespaces enter the next release.
6. Exact sensitive-data detection/redaction strategy and whether it may use an LLM.
7. Whether generic command adapter sessions can fully participate in universal transcript/handoff.

## Recommended discovery tasks
- Build a minimal VS Code extension spike that detects the official Claude Code extension and documents only supported interaction paths.
- Build adapter conformance fixtures for Ollama, one Anthropic-compatible service, and one OpenAI-compatible service.
- Prototype a policy decision engine with explicit model-provider versus supporting-network classification.
- Prototype local encrypted handoff metadata and deletion/retention behavior.
- Prototype activity ledger, overlapping-path warning, checkpoint, and worktree flows.
''',
'constitution.md': '''# Project Constitution Input

## Principles
1. **Native client boundaries are inviolable.** Do not collect, inspect, proxy, or persist credentials owned by official provider clients.
2. **No secret in version control.** Configuration references secrets; it does not contain them.
3. **Explicit disclosure precedes cloud-model egress.** Guarded and strict policy decisions must be visible, attributable, and reversible only through stated controls.
4. **Default to minimal handoff.** Summaries omit code and sensitive data until explicitly permitted.
5. **Never overclaim enforcement.** The product must state whether a policy governs only managed sessions or a broader environment.
6. **Capabilities are verified, not assumed.** Endpoint compatibility requires declared and tested behavior.
7. **Concurrent work must be observable.** Make writers, paths, commands, and possible conflicts visible; do not imply automatic correctness.
8. **Installers are reversible.** Preview, confirm, document, and cleanly remove only owned artifacts.
9. **Diagnostics are safe to share.** Redact all secrets and content by default.
10. **Fallbacks are first-class.** Unsupported native integration must degrade clearly to a safe handoff/session workflow.
'''
}
for name, content in files.items():
    (out/name).write_text(content)
print('\n'.join(str(out/name) for name in files))